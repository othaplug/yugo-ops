import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import {
  runPostPaymentActions,
  runPostPaymentActionsB2BDelivery,
} from "@/lib/automations/post-payment";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { logActivity } from "@/lib/activity";
import {
  isQuoteExpiredForBooking,
  quoteExpiryBlockedStatuses,
} from "@/lib/quote-expiry";
import {
  expectedB2BCardGrandTotalCad,
  isB2BDeliveryQuoteServiceType,
} from "@/lib/quotes/b2b-quote-copy";
import { getQuotePaymentPipelineMode } from "@/lib/quotes/payment-pipeline-mode";
import {
  getOfflineDepositInclusiveFromQuote,
  getQuoteTotalWithTaxFromRow,
} from "@/app/quote/[quoteId]/quote-shared";

/**
 * POST /api/admin/quotes/[quoteId]/confirm-offline-payment
 * Record cash/wire/cheque payment and create move or B2B delivery + confirmation automation.
 * Body: { kind: "deposit" | "full" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Quote id required" }, { status: 400 });
  }

  let body: { kind?: string };
  try {
    body = (await req.json()) as { kind?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind || "").toLowerCase();
  if (kind !== "deposit" && kind !== "full") {
    return NextResponse.json(
      { error: 'kind must be "deposit" or "full"' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: quote, error: qErr } = await admin
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("id", quoteId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const status = String(quote.status || "").toLowerCase();
  if (quoteExpiryBlockedStatuses().includes(status)) {
    return NextResponse.json(
      { error: "This quote cannot be booked in its current status" },
      { status: 400 },
    );
  }
  if (status === "lost") {
    return NextResponse.json(
      { error: "Recover this quote from Lost before booking offline" },
      { status: 400 },
    );
  }
  if (isQuoteExpiredForBooking(quote)) {
    return NextResponse.json(
      { error: "Quote has expired. Reactivate or send a new quote before booking" },
      { status: 400 },
    );
  }

  const humanQuoteId = String(quote.quote_id || "").trim();
  if (!humanQuoteId) {
    return NextResponse.json({ error: "Quote is missing a quote id" }, { status: 500 });
  }

  const { data: existingMove } = await admin
    .from("moves")
    .select("id, move_code")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMove?.id) {
    return NextResponse.json({
      ok: true,
      already_booked: true,
      move_id: existingMove.id,
      move_code: existingMove.move_code,
    });
  }

  const svc = String(quote.service_type ?? "");
  const { data: existingDel } = await admin
    .from("deliveries")
    .select("id, delivery_number")
    .eq("source_quote_id", quoteId)
    .maybeSingle();

  if (isB2BDeliveryQuoteServiceType(svc) && existingDel?.id) {
    return NextResponse.json({
      ok: true,
      already_booked: true,
      delivery_id: existingDel.id,
      delivery_number: existingDel.delivery_number,
    });
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const clientName = (contact?.name || "").trim();
  const clientEmail = (contact?.email || "").trim();
  if (!clientName || !clientEmail) {
    return NextResponse.json(
      { error: "Quote needs a contact with name and email" },
      { status: 400 },
    );
  }

  const mode = await getQuotePaymentPipelineMode(quote.service_type as string | null);
  if (mode === "full_upfront" && kind === "deposit") {
    return NextResponse.json(
      {
        error:
          "This service is paid in full upfront. Use full payment to confirm booking",
      },
      { status: 400 },
    );
  }

  const { totalWithTax } = getQuoteTotalWithTaxFromRow(quote);
  if (totalWithTax <= 0) {
    return NextResponse.json(
      { error: "Quote total is zero or missing" },
      { status: 400 },
    );
  }

  const depositIncl = getOfflineDepositInclusiveFromQuote(quote);
  let payAmount =
    kind === "full" ? totalWithTax : Math.min(totalWithTax, depositIncl);

  if (mode === "full_upfront") {
    payAmount = totalWithTax;
  }

  if (payAmount <= 0) {
    return NextResponse.json(
      { error: "Computed payment amount is invalid" },
      { status: 400 },
    );
  }

  const paymentId = `offline-admin-${quoteId}-${Date.now()}`;
  const selectedTier = quote.selected_tier ?? null;
  const selectedAddons = quote.selected_addons ?? [];

  try {
    if (isB2BDeliveryQuoteServiceType(svc)) {
      const expected = expectedB2BCardGrandTotalCad({
        custom_price:
          quote.custom_price != null ? Number(quote.custom_price) : null,
        service_type: svc,
      });
      if (
        expected != null &&
        Math.abs(Number(payAmount) - expected) > 1.5 &&
        kind === "full"
      ) {
        return NextResponse.json(
          {
            error:
              "Payment amount does not match quoted total. Check the quote or use Recover move if already paid",
          },
          { status: 400 },
        );
      }

      const d = await createDeliveryFromB2BQuote({
        quoteId: humanQuoteId,
        depositAmount: payAmount,
        selectedTier,
        selectedAddons: selectedAddons as never[],
        clientName,
        clientEmail,
        squareCustomerId: undefined,
        squareCardId: undefined,
        squarePaymentId: paymentId,
        squareReceiptUrl: null,
      });

      await admin
        .from("quotes")
        .update({
          status: "accepted",
          selected_tier: selectedTier,
          accepted_at: new Date().toISOString(),
          selected_addons: selectedAddons,
          payment_error: null,
          payment_failed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quoteId);

      const { trackingToken } = await issueDeliveryTrackingTokens(d.deliveryId);
      await sendB2BTrackingNotifications(d.deliveryId);
      const base = getEmailBaseUrl().replace(/\/$/, "");
      const trackingUrl = `${base}/delivery/track/${encodeURIComponent(trackingToken)}`;

      runPostPaymentActionsB2BDelivery({
        quoteId: humanQuoteId,
        deliveryId: d.deliveryId,
        deliveryNumber: d.deliveryNumber,
        paymentId,
        amount: payAmount,
      }).catch((err) =>
        console.error("[confirm-offline-payment] B2B post-payment:", err),
      );

      await logActivity({
        entity_type: "quote",
        entity_id: quoteId,
        event_type: "offline_booking",
        description: `Offline payment recorded (${kind}), delivery ${d.deliveryNumber}`,
        icon: "payment",
      });

      return NextResponse.json({
        ok: true,
        delivery_id: d.deliveryId,
        delivery_number: d.deliveryNumber,
        tracking_url: trackingUrl,
      });
    }

    const moveResult = await createMoveFromQuote({
      quoteId: humanQuoteId,
      depositAmount: payAmount,
      selectedTier,
      selectedAddons: selectedAddons as never[],
      clientName,
      clientEmail,
      squareCustomerId: undefined,
      squareCardId: undefined,
      squarePaymentId: paymentId,
      squareReceiptUrl: null,
    });

    await admin
      .from("quotes")
      .update({
        status: "accepted",
        selected_tier: selectedTier,
        accepted_at: new Date().toISOString(),
        selected_addons: selectedAddons,
        payment_error: null,
        payment_failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    runPostPaymentActions({
      quoteId: humanQuoteId,
      moveId: moveResult.moveId,
      moveCode: moveResult.moveCode,
      paymentId,
      amount: payAmount,
    }).catch((err) =>
      console.error("[confirm-offline-payment] post-payment:", err),
    );

    await logActivity({
      entity_type: "quote",
      entity_id: quoteId,
      event_type: "offline_booking",
      description: `Offline payment recorded (${kind}), move ${moveResult.moveCode}`,
      icon: "payment",
    });

    return NextResponse.json({
      ok: true,
      move_id: moveResult.moveId,
      move_code: moveResult.moveCode,
      tracking_url: moveResult.trackingUrl,
      amount: payAmount,
    });
  } catch (e) {
    console.error("[confirm-offline-payment]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Booking failed. Check logs and quote data",
      },
      { status: 500 },
    );
  }
}
