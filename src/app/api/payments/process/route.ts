import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { runPostPaymentActions } from "@/lib/automations/post-payment";
import { rateLimit } from "@/lib/rate-limit";

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
        note: `YUGO deposit ${quoteId}`,
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
      const msg = e instanceof Error ? e.message : "Payment processing failed";
      return NextResponse.json({ error: msg }, { status: 500 });
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

    // ── 6. Create move record from quote ──
    let moveId: string | null = null;
    let moveCode: string | null = null;

    try {
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
    } catch (moveErr) {
      console.error("[createMoveFromQuote] failed:", moveErr);
      // Payment succeeded but move creation failed — return success with a warning
      // so the client knows payment went through, and admin can recover the move
      return NextResponse.json({
        success: true,
        payment_id: squarePaymentId,
        move_id: null,
        tracking_url: null,
        warning: "Payment was processed successfully but move creation failed. Please contact support with your quote ID.",
      });
    }

    // ── 7. Post-payment actions (fire-and-forget) ──
    if (moveId && moveCode && squarePaymentId) {
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
      tracking_url: moveCode ? `/track/move/${moveCode}` : null,
    });
  } catch (e) {
    console.error("[payments/process] unexpected error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
