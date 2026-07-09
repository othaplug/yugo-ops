import { NextResponse } from "next/server";
import { squareClient } from "@/lib/square";
import { squareIdem } from "@/lib/square-idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { rateLimit } from "@/lib/rate-limit";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { finalizeBalancePaymentSettlement } from "@/lib/complete-balance-payment";
import { squareThrownErrorStructured } from "@/lib/square-payment-errors";
import { assertChargeMatchesStored } from "@/lib/payments/charge-amount-guard";
import { buildSquarePaymentNote } from "@/lib/square-payment-notes";

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

    // Card processing is already absorbed in the quoted price (same policy as
    // /api/cron/charge-balance). Charge the raw balance — never add a fee here.
    // A previous version surcharged 3.3% + $0.15, which double-charged clients
    // whose dashboard/email balance said one number and whose card was billed
    // a higher number (MV-30228 / Chidera Allison, 2026-06-22).
    const ccTotal = balanceAmount;
    const amountCents = Math.round(balanceAmount * 100);
    assertChargeMatchesStored({
      attemptedCents: amountCents,
      storedCents: Math.round(Number(move.balance_amount || 0) * 100),
      context: {
        site: "POST /api/payments/balance",
        move_id: moveId,
        move_code: move.move_code,
      },
    });

    // Attempt to store card if we have a customer
    let cardId: string | undefined;
    if (move.square_customer_id) {
      try {
        const cardRes = await squareClient.cards.create({
          sourceId,
          card: { customerId: move.square_customer_id },
          idempotencyKey: squareIdem("bal-card", moveId),
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
      buyerEmailAddress: move.client_email || undefined,
      referenceId: move.move_code || moveId,
      note: buildSquarePaymentNote({
        kind: "balance",
        code: move.move_code,
        serviceType: (move as { service_type?: string | null }).service_type,
        scheduledDate: (move as { scheduled_date?: string | null }).scheduled_date,
      }),
      idempotencyKey: squareIdem("bal-pay", moveId),
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
      balanceTaxInclusive: balanceAmount,
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
          processingFee: 0,
          transactionFee: 0,
          totalCharged: ccTotal,
          trackingUrl,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, payment_id: paymentId });
  } catch (e) {
    const structured = squareThrownErrorStructured(e);
    console.error(
      `[Square] balance payment failed: status=${structured.statusCode ?? "?"} ` +
        `code=${structured.code ?? "—"} detail=${(structured.detail ?? "").slice(0, 200)}`,
    );
    return NextResponse.json({ error: structured.message }, { status: 500 });
  }
}
