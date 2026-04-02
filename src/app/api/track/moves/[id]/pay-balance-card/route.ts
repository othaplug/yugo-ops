import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { finalizeBalancePaymentSettlement } from "@/lib/complete-balance-payment";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Charge the move's saved Square card for the current balance (e.g. post–inventory-change adjustment).
 * Requires a valid track token.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`track-bal-card:${ip}`, 8, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id: moveId } = await params;
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!verifyTrackToken("move", moveId, token)) {
      return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: move, error: fetchErr } = await admin.from("moves").select("*").eq("id", moveId).single();
    if (fetchErr || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const balanceAmount = Number(move.balance_amount || 0);
    if (balanceAmount <= 0) {
      return NextResponse.json({ error: "No balance to charge" }, { status: 400 });
    }
    if (!move.square_card_id) {
      return NextResponse.json({ error: "No card on file for this move" }, { status: 400 });
    }

    const processingFee = balanceAmount * 0.033;
    const transactionFee = 0.15;
    const ccTotal = balanceAmount + processingFee + transactionFee;
    const amountCents = Math.round(ccTotal * 100);

    const { locationId } = await getSquarePaymentConfig();
    if (!locationId) {
      return NextResponse.json({ error: "Payment configuration unavailable" }, { status: 503 });
    }

    const paymentRes = await squareClient.payments.create({
      sourceId: move.square_card_id,
      amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
      customerId: move.square_customer_id || undefined,
      referenceId: move.move_code || moveId,
      note: "Balance + processing fee, tracking page (card on file)",
      idempotencyKey: `bal-track-card-${moveId}`,
      locationId,
    });

    const paymentId = paymentRes.payment?.id;
    if (!paymentId) {
      return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
    }

    const receiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

    await finalizeBalancePaymentSettlement({
      admin,
      moveId,
      balancePreTax: balanceAmount,
      squarePaymentId: paymentId,
      squareReceiptUrl: receiptUrl,
      settlementMethod: "client",
      paymentMarkedBy: "client-track-card",
      updateMoveReceiptUrl: !!receiptUrl,
    });

    return NextResponse.json({ success: true, payment_id: paymentId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
