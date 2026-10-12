import { createAdminClient } from "@/lib/supabase/admin";

const HST_RATE = 0.13;

/**
 * Fold a collected (or now-owed) fee into a move's recognised contract total so
 * EVERY surface reflects it — operator directive: "always fold into one number,
 * even an approved extra item". This is the same bump the additional-charge /
 * add-addon routes already perform, extracted so the extra-item-accept and
 * change-request-fee paths (which charged the fee but left the contract behind,
 * e.g. MV-30428's Large Mirror) fold it too.
 *
 * Call ONCE per charge, and only when the charge was NEWLY recorded (never on an
 * idempotent retry — `chargeApprovedFeeOnCard` returns `alreadyRecorded` for
 * that), or the total double-counts.
 */
export async function foldFeeIntoMoveContract(
  admin: ReturnType<typeof createAdminClient>,
  moveId: string,
  fee: { preTax: number; inclusive: number },
): Promise<void> {
  const preTax = Math.round(fee.preTax * 100) / 100;
  const inclusive = Math.round(fee.inclusive * 100) / 100;
  if (preTax <= 0 && inclusive <= 0) return;

  const { data: move } = await admin
    .from("moves")
    .select("id, estimate, amount, total_price, final_amount, total_paid, hubspot_deal_id")
    .eq("id", moveId)
    .maybeSingle();
  if (!move) return;

  const oldEstimate = Number(move.estimate) || 0;
  const patch: Record<string, number> = {};
  // `estimate` is the reliable PRE-TAX base read by contractTaxFromMove / moves
  // list / profitability.
  if (oldEstimate > 0) patch.estimate = Math.round((oldEstimate + preTax) * 100) / 100;

  // `amount` is stored inconsistently (tax-incl on most rows, pre-tax on some);
  // match whichever convention this row already uses.
  const oldAmount = Number(move.amount) || 0;
  if (oldAmount > 0 && oldEstimate > 0) {
    const looksInclusive = Math.abs(oldAmount - oldEstimate * (1 + HST_RATE)) < 1;
    patch.amount = Math.round((oldAmount + (looksInclusive ? inclusive : preTax)) * 100) / 100;
  }

  // final_amount / total_price hold the TAX-INCLUSIVE edited total and outrank
  // estimate in contractTaxFromMove — bump them too when present.
  for (const field of ["final_amount", "total_price"] as const) {
    const cur = Number(move[field]) || 0;
    if (cur > 0) patch[field] = Math.round((cur + inclusive) * 100) / 100;
  }

  // total_paid tracks cash collected (tax-inclusive).
  if (move.total_paid != null) {
    patch.total_paid = Math.round(((Number(move.total_paid) || 0) + inclusive) * 100) / 100;
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await admin.from("moves").update(patch).eq("id", moveId);
  if (error) {
    // Money is already charged + ledgered — never throw, just surface for recon.
    console.error("[fold-fee] move total bump failed:", error.message);
    return;
  }
  // Push the new total to HubSpot immediately (not just on the hourly reconcile).
  const { syncMoveDealAmountNow } = await import("@/lib/hubspot/sync-move-deal-amount");
  void syncMoveDealAmountNow(moveId);
}
