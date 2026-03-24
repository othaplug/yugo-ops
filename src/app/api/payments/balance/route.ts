import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { rateLimit } from "@/lib/rate-limit";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { finalizeBalancePaymentSettlement } from "@/lib/complete-balance-payment";

/**
 * Process a voluntary balance payment from the client payment page.
 * Charges the card (new nonce or stored card) with CC fee included.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`balance:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const { sourceId, moveId } = body as { sourceId: string; moveId: string };

    if (!sourceId || !moveId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: move, error: fetchErr } = await supabase
      .from("moves")
      .select("*")
      .eq("id", moveId)
      .single();

    if (fetchErr || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const balanceAmount = Number(move.balance_amount || 0);
    if (balanceAmount <= 0) {
      return NextResponse.json({ error: "No balance to charge" }, { status: 400 });
    }

    const processingFee = balanceAmount * 0.033;
    const transactionFee = 0.15;
    const ccTotal = balanceAmount + processingFee + transactionFee;
    const amountCents = Math.round(ccTotal * 100);

    // Attempt to store card if we have a customer
    let cardId: string | undefined;
    if (move.square_customer_id) {
      try {
        const cardRes = await squareClient.cards.create({
          sourceId,
          card: { customerId: move.square_customer_id },
          idempotencyKey: `bal-card-${moveId}-${Date.now()}`,
        });
        cardId = cardRes.card?.id;
      } catch {
        // Fall through — charge with nonce directly
      }
    }

    const paymentSourceId = cardId ?? sourceId;

    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json({ error: "Payment configuration unavailable" }, { status: 503 });
    }

    const paymentRes = await squareClient.payments.create({
      sourceId: paymentSourceId,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: move.square_customer_id || undefined,
      referenceId: move.move_code || moveId,
      note: "Balance + processing fee, client payment",
      idempotencyKey: `bal-pay-${moveId}-${Date.now()}`,
      locationId,
    });

    const paymentId = paymentRes.payment?.id;
    if (!paymentId) {
      return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
    }

    const receiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

    await finalizeBalancePaymentSettlement({
      admin: supabase,
      moveId,
      balancePreTax: balanceAmount,
      squarePaymentId: paymentId,
      squareReceiptUrl: receiptUrl,
      settlementMethod: "client",
      paymentMarkedBy: "client",
      updateMoveReceiptUrl: true,
    });

    const paidAt = new Date().toISOString();
    await supabase.from("status_events").insert({
      entity_type: "move",
      entity_id: moveId,
      event_type: "payment_received",
      description: `Client paid balance via payment page, $${ccTotal.toFixed(2)} CAD`,
      icon: "dollar",
    });

    // Send receipt email
    if (move.client_email) {
      const baseUrl = getEmailBaseUrl();
      const trackToken = signTrackToken("move", moveId);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? moveId}?token=${trackToken}`;

      sendEmail({
        to: move.client_email,
        subject: `Payment receipt $${ccTotal.toFixed(2)} for ${move.move_code || "your move"}`,
        template: "balance-auto-charge-receipt",
        data: {
          clientName: move.client_name || "",
          moveCode: move.move_code || moveId,
          baseBalance: balanceAmount,
          processingFee,
          transactionFee,
          totalCharged: ccTotal,
          trackingUrl,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, payment_id: paymentId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
