import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/track/moves/[id]/crew-change-request/[requestId]/approve?token=...
// Client approves the crew-submitted walkthrough change request.
// If card on file → charge immediately.
// If no card → mark approved_pending_payment and prompt client to add a card.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`crew-cr-approve:${ip}`, 5, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: moveId, requestId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the change request
  const { data: cr, error: crErr } = await admin
    .from("inventory_change_requests")
    .select("*")
    .eq("id", requestId)
    .eq("move_id", moveId)
    .eq("source", "crew")
    .in("status", ["pending", "admin_reviewing"])
    .maybeSingle();

  if (crErr || !cr) {
    return NextResponse.json({ error: "Change request not found or already resolved" }, { status: 404 });
  }

  if (cr.client_response) {
    return NextResponse.json({ error: "Already responded to this request" }, { status: 400 });
  }

  const { data: move } = await admin.from("moves").select("*").eq("id", moveId).single();
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const delta = Number(cr.auto_calculated_delta) || 0;
  const hst = Math.round(delta * 0.13 * 100) / 100;
  const chargeAmount = Math.round((delta + hst) * 100) / 100;

  let paymentTransactionId: string | null = null;
  let paymentCharged = false;
  let responseState: "approved" | "approved_pending_payment" = "approved_pending_payment";

  // Try to charge card on file if delta > 0
  if (delta > 0 && move.square_card_id) {
    try {
      const { locationId } = await getSquarePaymentConfig();
      if (locationId) {
        const amountCents = Math.round(chargeAmount * 100);
        const paymentRes = await squareClient.payments.create({
          sourceId: move.square_card_id,
          amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
          customerId: move.square_customer_id || undefined,
          referenceId: String(move.move_code || moveId),
          note: `Walkthrough change request, ${String(cr.id)}, extras approved`,
          idempotencyKey: `crew-cr-approve-${requestId}`,
          locationId,
        });

        if (paymentRes?.payment?.id) {
          paymentTransactionId = paymentRes.payment.id;
          paymentCharged = true;
          responseState = "approved";
        }
      }
    } catch {
      // Payment failed — fall through to approved_pending_payment
    }
  } else if (delta <= 0) {
    // No charge needed (net credit or zero)
    responseState = "approved";
  }

  // Update the change request
  await admin
    .from("inventory_change_requests")
    .update({
      client_response: responseState === "approved" ? "approved" : "approved_pending_payment",
      client_responded_at: new Date().toISOString(),
      payment_charged: paymentCharged,
      payment_amount: chargeAmount > 0 ? chargeAmount : null,
      payment_transaction_id: paymentTransactionId,
      status: "approved",
    })
    .eq("id", requestId);

  // Update move totals
  const curAmount = Number(move.amount) || 0;
  const newAmount = Math.max(0, curAmount + delta);
  await admin
    .from("moves")
    .update({
      amount: newAmount,
      estimate: newAmount,
      pending_inventory_change_request_id: null,
      ...(paymentCharged ? { total_paid: (Number(move.total_paid) || 0) + chargeAmount } : {}),
    })
    .eq("id", moveId);

  // Apply inventory changes to move_inventory
  const itemsAdded = Array.isArray(cr.items_added) ? cr.items_added as Array<{ item_name?: string; quantity?: number }> : [];
  const itemsRemoved = Array.isArray(cr.items_removed) ? cr.items_removed as Array<{ move_inventory_id?: string }> : [];

  for (const item of itemsAdded) {
    if (!item?.item_name) continue;
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const label = qty > 1 ? `${item.item_name} ×${qty}` : item.item_name;
    await admin.from("move_inventory").insert({ move_id: moveId, room: "Other", item_name: label });
  }
  for (const item of itemsRemoved) {
    const id = String(item?.move_inventory_id || "").trim();
    if (!id) continue;
    await admin.from("move_inventory").delete().eq("id", id).eq("move_id", moveId);
  }

  // Notify crew (push notification via status_events for admin audit trail)
  try {
    await admin.from("status_events").insert({
      entity_type: "move",
      entity_id: String(move.move_code || moveId),
      event_type: "change_request",
      description: `Client approved walkthrough change request. ${paymentCharged ? `Charged $${chargeAmount.toFixed(2)}.` : "Payment pending."} Load extras.`,
      icon: "check",
    });
  } catch { /* non-fatal */ }

  // SMS crew
  try {
    if (move.crew_id) {
      const { data: crew } = await admin
        .from("crews")
        .select("phone")
        .eq("id", move.crew_id)
        .maybeSingle();
      if (crew?.phone) {
        const smsg = [
          `Yugo: Client approved extras.`,
          paymentCharged ? `$${chargeAmount.toFixed(2)} charged.` : `Payment pending.`,
          `Load all extra items now.`,
        ].join("\n\n");
        await sendSMS(normalizePhone(crew.phone), smsg);
      }
    }
  } catch { /* optional */ }

  return NextResponse.json({ ok: true, state: responseState, charge_amount: chargeAmount });
}
