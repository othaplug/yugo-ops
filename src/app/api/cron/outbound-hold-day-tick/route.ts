/**
 * GET /api/cron/outbound-hold-day-tick
 *
 * Nightly cron — recompute the warehouse-hold portion of every outbound
 * shipment that is currently at the warehouse (received but not yet
 * handed off), and adjust hold_days + hold_price_total + total_price if
 * the actual time the item has been on the floor exceeds what the partner
 * was originally quoted.
 *
 * Why this exists: the booking-time `hold_days` is the partner's BEST
 * GUESS. Reality is messier — carriers reschedule, partners take longer
 * to schedule the freight pickup, weather delays. Without this cron, the
 * shipment row's "total_price" stays stuck at the booking-day estimate
 * and the partner is undercharged when they overrun.
 *
 * Mechanics:
 *   1. For each shipment with status in {at_warehouse, palletizing, ready_for_carrier},
 *      compute actual_hold_days = ceil((now - received_at_warehouse_at) / day).
 *   2. If actual_hold_days > hold_days_on_row, recompute the hold price
 *      using the shipment's own free_hold_days + hold_price_per_day (so a
 *      future policy change doesn't retroactively reprice old shipments).
 *   3. Update hold_days, hold_price_total, subtotal, tax_amount, total_price.
 *   4. Append a one-line note to internal_notes so admin can audit.
 *
 * Idempotent: running twice in a single day is a no-op for shipments
 * already at the right hold-day count.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OUTBOUND_STAGING_HST_RATE } from "@/lib/outbound-staging/pricing";

const HOLD_BUCKETS = ["at_warehouse", "palletizing", "ready_for_carrier"] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  // Vercel cron passes a signature header; for now we accept all GETs but
  // log who's calling.
  const ua = req.headers.get("user-agent") ?? "unknown";

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("outbound_shipments")
    .select("*")
    .in("status", HOLD_BUCKETS as unknown as string[])
    .not("received_at_warehouse_at", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const updated: Array<{ id: string; from_hold_days: number; to_hold_days: number; new_total: number }> = [];

  for (const row of rows ?? []) {
    const receivedAt = row.received_at_warehouse_at
      ? new Date(String(row.received_at_warehouse_at)).getTime()
      : null;
    if (!receivedAt) continue;

    const actualHoldDays = Math.max(0, Math.ceil((now - receivedAt) / dayMs));
    const storedHoldDays = Number(row.hold_days ?? 0);
    if (actualHoldDays <= storedHoldDays) continue;

    const freeHoldDays = Number(row.free_hold_days ?? 3);
    const perDay = Number(row.hold_price_per_day ?? 18);
    const billableHoldDays = Math.max(0, actualHoldDays - freeHoldDays);

    // Floor: never go below the partner's booked hold charge. The cron
    // exists to catch overruns, not to retroactively cut a price the
    // partner already agreed to. So if booked hold_price_total exceeds
    // the recomputed amount, hold at the booked value.
    const storedHoldTotal = Number(row.hold_price_total ?? 0);
    const recomputedHoldTotal = round2(billableHoldDays * perDay);
    const newHoldTotal = Math.max(storedHoldTotal, recomputedHoldTotal);

    // No-op when the recomputed hold doesn't exceed what's already on the
    // row — avoids writing a duplicate audit note.
    if (newHoldTotal <= storedHoldTotal) continue;

    // Subtotal = pickup + palletization + intake fee + holdTotal + declared_value_fee
    const pickupPrice = Number(row.pickup_price ?? 0);
    const palletizationPrice = Number(row.palletization_price ?? 0);
    const intakeFee = Number(row.warehouse_intake_fee ?? 0);
    const declaredValueFee = Number(row.declared_value_fee ?? 0);

    const newSubtotal = round2(
      pickupPrice + palletizationPrice + intakeFee + newHoldTotal + declaredValueFee,
    );
    const newTax = round2(newSubtotal * OUTBOUND_STAGING_HST_RATE);
    const newTotal = round2(newSubtotal + newTax);

    const noteLine = `[hold-day cron] hold_days ${storedHoldDays} → ${actualHoldDays}; hold_price_total $${(row.hold_price_total ?? 0).toString()} → $${newHoldTotal.toFixed(2)}; total $${(row.total_price ?? 0).toString()} → $${newTotal.toFixed(2)}.`;
    const existingNotes = String(row.internal_notes ?? "").trim();
    const newNotes = existingNotes
      ? `${existingNotes}\n\n[${new Date().toISOString()}] ${noteLine}`
      : `[${new Date().toISOString()}] ${noteLine}`;

    const { error: upErr } = await admin
      .from("outbound_shipments")
      .update({
        hold_days: actualHoldDays,
        hold_price_total: newHoldTotal,
        subtotal: newSubtotal,
        tax_amount: newTax,
        total_price: newTotal,
        internal_notes: newNotes,
      })
      .eq("id", row.id);
    if (!upErr) {
      updated.push({
        id: row.id,
        from_hold_days: storedHoldDays,
        to_hold_days: actualHoldDays,
        new_total: newTotal,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: rows?.length ?? 0,
    updated: updated.length,
    details: updated,
    called_by: ua,
  });
}
