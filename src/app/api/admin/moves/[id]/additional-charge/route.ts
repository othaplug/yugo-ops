/**
 * POST /api/admin/moves/[id]/additional-charge
 *
 * Collect an ADDITIONAL charge (extra items, wait time, scope creep discovered
 * after booking) on the move's card on file. Unlike "Adjust final price" — which
 * only corrects the recorded number and moves no money — this actually:
 *   1. adds HST (13%) to the admin-entered pre-tax amount,
 *   2. grosses it up for card-processing recovery (same math as every quote),
 *   3. charges the card on file via `chargeApprovedFeeOnCard`, and
 *   4. records a `move_payment_ledger` "card" row with the Square receipt — which
 *      auto-surfaces on the Money tab (Payment transactions) AND the client
 *      portal Documents (buildLedgerReceiptDocs).
 *
 * The charge is recorded as an `adjustment` (outside the original contract), so
 * the contract "collected" bar stays honest while "Recorded payments" reflects
 * the true total taken — the same model extra-item fees already use.
 *
 * Kept deliberately separate from the price-adjust modal: charging a customer's
 * card must be an explicit, single-purpose action, never a side effect of an
 * operator correcting a number.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";
import { grossUpForProcessing } from "@/lib/pricing/processing-recovery";
import { chargeApprovedFeeOnCard } from "@/lib/charge-approved-fee";
import { logAudit } from "@/lib/audit";

const HST_RATE = 0.13;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, admin, error } = await requireAdmin();
  if (error) return error;
  if (!user || !canEditFinalJobPrice(admin?.role ?? null, user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move id required" }, { status: 400 });

  let body: {
    amount?: number;
    reason?: string;
    apply_cc_recovery?: boolean;
    idempotency_key?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const preTaxEntered = Number(body.amount);
  const reason = String(body.reason ?? "").trim();
  const applyCcRecovery = body.apply_cc_recovery !== false; // default on
  const idemKey =
    typeof body.idempotency_key === "string" && body.idempotency_key.trim()
      ? body.idempotency_key.trim().slice(0, 64)
      : randomUUID();

  if (!Number.isFinite(preTaxEntered) || preTaxEntered <= 0) {
    return NextResponse.json({ error: "Enter a positive amount" }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const db = createAdminClient();

  const { data: move, error: moveErr } = await db
    .from("moves")
    .select(
      "id, move_code, client_name, square_customer_id, square_card_id, estimate, amount, total_price, final_amount, total_paid",
    )
    .eq("id", moveId)
    .single();
  if (moveErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }
  if (!move.square_card_id && !move.square_customer_id) {
    return NextResponse.json(
      { error: "No card on file for this move — can't collect an additional charge automatically." },
      { status: 400 },
    );
  }

  // Config drives the recovery rate (falls back to Square's 2.9% + $0.30).
  const { data: cfgRows } = await db.from("platform_config").select("key, value");
  const cfg: Record<string, string> = {};
  for (const r of cfgRows ?? []) cfg[r.key] = r.value;

  // Pre-tax → (optional CC recovery) → HST → tax-inclusive amount to charge.
  const preTax =
    applyCcRecovery
      ? Math.round(grossUpForProcessing(preTaxEntered, cfg) * 100) / 100
      : Math.round(preTaxEntered * 100) / 100;
  const hst = Math.round(preTax * HST_RATE * 100) / 100;
  const inclusive = Math.round((preTax + hst) * 100) / 100;

  const label = `Additional charge — ${reason}`;
  const result = await chargeApprovedFeeOnCard({
    admin: db,
    moveId,
    feeInclusive: inclusive,
    label,
    idemSuffix: `addl-${idemKey}`,
  });

  if (!result.charged) {
    // Nothing was recorded (the helper only writes the ledger on success).
    return NextResponse.json(
      { error: result.reason || "The card could not be charged." },
      { status: 402 },
    );
  }

  // Roll the collected extra into the move's recognised total so every surface
  // reflects it. `estimate` is the one reliable PRE-TAX base — the moves list
  // (final_amount ?? total_price ?? estimate), the profitability revenue, and
  // contractTaxFromMove() all resolve to it — so bumping it flows the charge
  // through to the contract headline, the list amount, and margin. Without this
  // the charge collected fine but every total still read the old contract.
  const oldEstimate = Number(move.estimate) || 0;
  const totalsPatch: Record<string, number> = {};
  if (oldEstimate > 0) totalsPatch.estimate = Math.round((oldEstimate + preTax) * 100) / 100;

  // `amount` is stored inconsistently (tax-inclusive on most rows, pre-tax on
  // some). Match whichever convention this row already uses instead of assuming.
  const oldAmount = Number(move.amount) || 0;
  if (oldAmount > 0 && oldEstimate > 0) {
    const looksInclusive = Math.abs(oldAmount - oldEstimate * (1 + HST_RATE)) < 1;
    totalsPatch.amount =
      Math.round((oldAmount + (looksInclusive ? inclusive : preTax)) * 100) / 100;
  }

  // final_amount / total_price hold the TAX-INCLUSIVE total when a price was
  // manually edited, and they outrank `estimate` in every reader — bump them
  // too or the new total would be invisible on manually-priced moves.
  for (const field of ["final_amount", "total_price"] as const) {
    const cur = Number(move[field]) || 0;
    if (cur > 0) totalsPatch[field] = Math.round((cur + inclusive) * 100) / 100;
  }

  // total_paid tracks cash collected (tax-inclusive).
  if (move.total_paid != null) {
    totalsPatch.total_paid =
      Math.round(((Number(move.total_paid) || 0) + inclusive) * 100) / 100;
  }

  if (Object.keys(totalsPatch).length > 0) {
    const { error: bumpErr } = await db.from("moves").update(totalsPatch).eq("id", moveId);
    if (bumpErr) {
      // The money is already collected and ledgered — never fail the request
      // here, just surface it so the total can be reconciled.
      console.error("[additional-charge] move total bump failed:", bumpErr.message);
    }
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: "additional_charge_collected",
    resourceType: "move",
    resourceId: moveId,
    details: {
      move_code: move.move_code,
      reason,
      amount_entered_pre_tax: Math.round(preTaxEntered * 100) / 100,
      apply_cc_recovery: applyCcRecovery,
      pre_tax: preTax,
      hst,
      inclusive,
      square_payment_id: result.squarePaymentId,
    },
  });

  return NextResponse.json({
    ok: true,
    charged: true,
    pre_tax: preTax,
    hst,
    inclusive,
    receipt_url: result.receiptUrl,
    square_payment_id: result.squarePaymentId,
  });
}
