import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import { runPostPaymentActions, runPostPaymentActionsB2BDelivery } from "@/lib/automations/post-payment";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { rateLimit } from "@/lib/rate-limit";
import { isQuoteExpiredForBooking, quoteExpiryBlockedStatuses } from "@/lib/quote-expiry";
import { squareThrownErrorMessage } from "@/lib/square-payment-errors";
import { logActivity } from "@/lib/activity";
import { notifyAllAdmins } from "@/lib/notifications";
import {
  expectedB2BCardGrandTotalCad,
  isB2BInvoiceQuote,
  isB2BDeliveryQuoteServiceType,
} from "@/lib/quotes/b2b-quote-copy";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`pay:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      sourceId,
      amount,
      quoteId,
      clientName,
      clientEmail,
      selectedTier,
      selectedAddons,
    } = body as {
      sourceId: string;
      amount: number;
      quoteId: string;
      clientName: string;
      clientEmail: string;
      selectedTier?: string;
      selectedAddons?: unknown[];
    };

    if (!sourceId || !amount || !quoteId || !clientName || !clientEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── 1. Verify quote exists and amount is plausible ──
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("quote_id", quoteId)
      .single();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status === "accepted") {
      return NextResponse.json({ error: "Quote already accepted" }, { status: 409 });
    }

    const st = String(quote.status || "").toLowerCase();
    if (quoteExpiryBlockedStatuses().includes(st)) {
      return NextResponse.json(
        { error: "This quote is no longer available. Request a new quote if you still need service." },
        { status: 410 },
      );
    }
    if (isQuoteExpiredForBooking(quote)) {
      return NextResponse.json(
        { error: "This quote has expired. Request a new quote from your coordinator." },
        { status: 410 },
      );
    }

    const factors = quote.factors_applied as Record<string, unknown> | null | undefined;
    const svc = String(quote.service_type ?? "");
    const selAddons = quote.selected_addons;
    const noQuoteAddons =
      selAddons == null || (Array.isArray(selAddons) && selAddons.length === 0);
    if (
      isB2BDeliveryQuoteServiceType(svc) &&
      !isB2BInvoiceQuote(factors, svc) &&
      noQuoteAddons
    ) {
      const expected = expectedB2BCardGrandTotalCad({
        custom_price: quote.custom_price != null ? Number(quote.custom_price) : null,
        service_type: svc,
      });
      if (expected != null && Math.abs(Number(amount) - expected) > 1.5) {
        return NextResponse.json(
          { error: "Payment amount does not match the quoted total. Refresh the page or contact your coordinator." },
          { status: 400 },
        );
      }
    }

    const amountCents = Math.round(amount * 100);
    const [firstName, ...lastParts] = clientName.trim().split(" ");
    const lastName = lastParts.join(" ") || ".";

    // ── 2. Create or find Square Customer ──
    let squareCustomerId: string | undefined;

    try {
      const searchRes = await squareClient.customers.search({
        query: {
          filter: {
            emailAddress: { exact: clientEmail },
          },
        },
      });
      squareCustomerId = searchRes.customers?.[0]?.id;
    } catch {
      // search failed, will create new
    }

    if (!squareCustomerId) {
      try {
        const createRes = await squareClient.customers.create({
          givenName: firstName,
          familyName: lastName,
          emailAddress: clientEmail,
          referenceId: quoteId,
        });
        squareCustomerId = createRes.customer?.id;
      } catch (e) {
        console.error("[Square] customer create failed:", e);
        return NextResponse.json({ error: "Failed to create customer profile" }, { status: 500 });
      }
    }

    // ── 3. Store Card on File ──
    let squareCardId: string | undefined;

    try {
      const cardRes = await squareClient.cards.create({
        sourceId,
        card: {
          customerId: squareCustomerId!,
        },
        idempotencyKey: `card-${quoteId}-${Date.now()}`,
      });
      squareCardId = cardRes.card?.id;
    } catch (e) {
      console.error("[Square] card storage failed:", e);
      // Fall through — we can still charge with the nonce directly
    }

    // ── 4. Create Payment ──
    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json(
        { error: "Payment is not configured. Please contact support." },
        { status: 503 }
      );
    }
    const paymentSourceId = squareCardId ?? sourceId;
    let squarePaymentId: string | undefined;
    let squareReceiptUrl: string | null = null;

    try {
      const paymentRes = await squareClient.payments.create({
        sourceId: paymentSourceId,
        amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
        customerId: squareCustomerId,
        referenceId: quoteId,
        note:
          String(quote.service_type) === "b2b_oneoff" || String(quote.service_type) === "b2b_delivery"
            ? `YUGO B2B delivery payment ${quoteId}`
            : `YUGO deposit ${quoteId}`,
        idempotencyKey: `pay-${quoteId}-${Date.now()}`,
        locationId,
      });
      squarePaymentId = paymentRes.payment?.id;
      squareReceiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

      if (!squarePaymentId) {
        return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
      }
    } catch (e) {
      console.error("[Square] payment failed:", e);
      const msg = squareThrownErrorMessage(e);
      notifyAllAdmins({
        title: "Quote payment failed",
        body: `Quote ${quoteId} — ${clientEmail}: ${msg}`,
        icon: "warning",
        sourceType: "payment",
        sourceId: quoteId,
      }).catch(() => {});
      return NextResponse.json({ error: msg }, { status: 402 });
    }

    // ── 5. Update quote → accepted ──
    await supabase
      .from("quotes")
      .update({
        status: "accepted",
        selected_tier: selectedTier ?? null,
        accepted_at: new Date().toISOString(),
        selected_addons: selectedAddons ?? [],
      })
      .eq("id", quote.id);

    const svcType = String(quote.service_type ?? "");
    const isB2bPay = isB2BDeliveryQuoteServiceType(svcType);

    let moveId: string | null = null;
    let moveCode: string | null = null;
    let deliveryId: string | null = null;
    let deliveryNumber: string | null = null;
    let trackingUrl: string | null = null;

    try {
      if (isB2bPay) {
        const d = await createDeliveryFromB2BQuote({
          quoteId,
          depositAmount: amount,
          selectedTier: selectedTier ?? null,
          selectedAddons: selectedAddons ?? [],
          clientName,
          clientEmail,
          squareCustomerId,
          squareCardId,
          squarePaymentId,
          squareReceiptUrl,
        });
        deliveryId = d.deliveryId;
        deliveryNumber = d.deliveryNumber;
        const { trackingToken } = await issueDeliveryTrackingTokens(deliveryId);
        await sendB2BTrackingNotifications(deliveryId);
        const base = getEmailBaseUrl().replace(/\/$/, "");
        trackingUrl = `${base}/delivery/track/${encodeURIComponent(trackingToken)}`;
      } else {
        const moveResult = await createMoveFromQuote({
          quoteId,
          depositAmount: amount,
          selectedTier: selectedTier ?? null,
          selectedAddons: selectedAddons ?? [],
          clientName,
          clientEmail,
          squareCustomerId,
          squareCardId,
          squarePaymentId,
          squareReceiptUrl,
        });
        moveId = moveResult.moveId;
        moveCode = moveResult.moveCode;
      }
    } catch (jobErr) {
      console.error("[payments/process] job creation failed:", jobErr);
      return NextResponse.json({
        success: true,
        payment_id: squarePaymentId,
        move_id: null,
        delivery_id: null,
        tracking_url: null,
        warning: isB2bPay
          ? "Payment was processed successfully but delivery creation failed. Please contact support with your quote ID."
          : "Payment was processed successfully but move creation failed. Please contact support with your quote ID.",
      });
    }

    // ── 7. Log to activity feed ──
    await logActivity({
      entity_type: "quote",
      entity_id: quoteId,
      event_type: "accepted",
      description: `Quote accepted by ${clientName}, $${amount.toLocaleString()} paid (${quoteId})`,
      icon: "payment",
    });

    // ── 8. Post-payment actions (fire-and-forget) ──
    if (isB2bPay && deliveryId && deliveryNumber && squarePaymentId) {
      runPostPaymentActionsB2BDelivery({
        quoteId,
        deliveryId,
        deliveryNumber,
        paymentId: squarePaymentId,
        amount,
      }).catch((err) => console.error("[postPayment B2B delivery] error:", err));
    } else if (moveId && moveCode && squarePaymentId) {
      runPostPaymentActions({
        quoteId,
        moveId,
        moveCode,
        paymentId: squarePaymentId,
        amount,
      }).catch((err) => console.error("[postPayment] error:", err));
    }

    return NextResponse.json({
      success: true,
      payment_id: squarePaymentId,
      move_id: moveId,
      delivery_id: deliveryId,
      tracking_url: isB2bPay
        ? trackingUrl
        : moveCode
          ? `/track/move/${moveCode}`
          : null,
    });
  } catch (e) {
    console.error("[payments/process] unexpected error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
