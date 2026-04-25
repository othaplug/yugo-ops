import { createAdminClient } from "@/lib/supabase/admin";
import {
  ontarioHstBreakdownFromPreTax,
  splitOntarioTaxInclusive,
} from "@/lib/format-currency";

export type AdminClient = ReturnType<typeof createAdminClient>;

export type BalanceSettlementMethod = "card" | "auto-charge" | "client" | "admin";

/** Pre-tax deposit subtotal from the move (column or 25% of pre-tax `estimate`). */
export const depositPreTaxFromMove = (move: {
  deposit_amount?: unknown;
  estimate?: unknown;
  amount?: unknown;
}): number => {
  const estimate = Number(move.estimate ?? move.amount ?? 0);
  const fromColumn = Number(move.deposit_amount);
  if (!Number.isNaN(fromColumn) && fromColumn > 0) {
    return Math.round(fromColumn * 100) / 100;
  }
  return Math.round(estimate * 0.25 * 100) / 100;
}

/** @deprecated Use `depositPreTaxFromMove` (deposit is pre-tax, HST on top). */
export const depositTaxInclusiveFromMove = depositPreTaxFromMove

/**
 * Record an admin-confirmed deposit: ledger row + deposit_paid_at + total_paid.
 * Does not clear balance_amount (balance remains due until settled separately).
 */
export async function recordAdminDepositForMove(opts: {
  admin: AdminClient;
  moveId: string;
  /** Pre-tax deposit subtotal (same units as `moves.deposit_amount`). HST is added on top for ledger. */
  depositPreTax: number;
  paymentMarkedBy: string;
}): Promise<{ recognized: number }> {
  const { admin, moveId, paymentMarkedBy } = opts;
  const preFromOpts = Math.round(opts.depositPreTax * 100) / 100;
  if (preFromOpts <= 0) {
    throw new Error("Deposit amount is missing or invalid for this move");
  }

  const { data: existingLedger } = await admin
    .from("move_payment_ledger")
    .select("id")
    .eq("move_id", moveId)
    .eq("entry_type", "deposit")
    .limit(1)
    .maybeSingle();
  if (existingLedger) {
    throw new Error("Deposit is already recorded in the payment ledger");
  }

  const { data: move, error: moveErr } = await admin
    .from("moves")
    .select("total_paid, amount, status, deposit_paid_at")
    .eq("id", moveId)
    .single();
  if (moveErr || !move) throw new Error(moveErr?.message || "Move not found");
  if (move.deposit_paid_at) {
    throw new Error("Deposit has already been recorded for this move");
  }

  const { preTax, hst, inclusive } = ontarioHstBreakdownFromPreTax(preFromOpts);
  const recognized = inclusive;
  const paidAt = new Date().toISOString();

  const { error: ledErr } = await admin.from("move_payment_ledger").insert({
    move_id: moveId,
    entry_type: "deposit",
    label: "Contract deposit",
    pre_tax_amount: preTax,
    hst_amount: hst,
    square_payment_id: null,
    square_receipt_url: null,
    inventory_change_request_id: null,
    settlement_method: "admin",
    paid_at: paidAt,
  });
  if (ledErr) throw new Error(ledErr.message);

  const prev = move.total_paid != null && move.total_paid !== ""
    ? Number(move.total_paid)
    : null;
  const newTotalPaid =
    prev != null ? Math.round((prev + recognized) * 100) / 100 : recognized;

  const PAST_PAID_STATUSES = new Set(["paid", "in_progress", "completed", "cancelled"]);
  const patch: Record<string, unknown> = {
    deposit_paid_at: paidAt,
    total_paid: newTotalPaid,
    payment_marked_paid: true,
    payment_marked_paid_at: paidAt,
    payment_marked_paid_by: paymentMarkedBy.trim(),
    updated_at: paidAt,
  };
  if (!PAST_PAID_STATUSES.has(move.status ?? "")) {
    patch.status = "paid";
  }

  const { error: upErr } = await admin.from("moves").update(patch).eq("id", moveId);
  if (upErr) throw new Error(upErr.message);

  return { recognized };
}

export async function findInventoryChangeForBalancePayment(
  admin: AdminClient,
  moveId: string,
  balanceTaxInclusive: number,
): Promise<string | null> {
  const { data } = await admin
    .from("inventory_change_requests")
    .select("id, additional_deposit_required")
    .eq("move_id", moveId)
    .in("status", ["approved", "adjusted"])
    .gt("additional_deposit_required", 0)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (Math.abs(Number(data.additional_deposit_required) - balanceTaxInclusive) <= 0.05) return data.id as string;
  return null;
}

/**
 * After a successful balance / adjustment collection, append ledger row and update move.
 * `balanceTaxInclusive` must match `move.balance_amount` before clearing (same tax-inclusive units as the move row).
 */
export async function finalizeBalancePaymentSettlement(opts: {
  admin: AdminClient;
  moveId: string;
  balanceTaxInclusive: number;
  squarePaymentId?: string | null;
  squareReceiptUrl?: string | null;
  settlementMethod: BalanceSettlementMethod;
  paymentMarkedBy: string;
  /** When true, set square_receipt_url on moves (first receipt wins if already set) */
  updateMoveReceiptUrl?: boolean;
}): Promise<{ recognized: number; inventoryChangeRequestId: string | null }> {
  const {
    admin,
    moveId,
    balanceTaxInclusive,
    squarePaymentId,
    squareReceiptUrl,
    settlementMethod,
    paymentMarkedBy,
    updateMoveReceiptUrl = false,
  } = opts;

  const inclusive = Math.round(balanceTaxInclusive * 100) / 100;
  const { preTax, hst } = splitOntarioTaxInclusive(inclusive);
  const recognized = inclusive;
  const inventoryChangeRequestId = await findInventoryChangeForBalancePayment(admin, moveId, inclusive);
  const label = inventoryChangeRequestId ? "Change request adjustment" : "Final payment";
  const entryType = inventoryChangeRequestId ? "inventory_change" : "balance";

  const { data: move, error: moveErr } = await admin.from("moves").select("total_paid, amount, status").eq("id", moveId).single();
  if (moveErr || !move) throw new Error(moveErr?.message || "Move not found");

  const prev = move.total_paid != null ? Number(move.total_paid) : null;
  let newTotalPaid: number;
  if (prev != null) {
    newTotalPaid = Math.round((prev + recognized) * 100) / 100;
  } else {
    newTotalPaid = Math.round((Number(move.amount) || recognized) * 100) / 100;
  }

  const paidAt = new Date().toISOString();

  const { error: ledErr } = await admin.from("move_payment_ledger").insert({
    move_id: moveId,
    entry_type: entryType,
    label,
    pre_tax_amount: preTax,
    hst_amount: hst,
    square_payment_id: squarePaymentId ?? null,
    square_receipt_url: squareReceiptUrl ?? null,
    inventory_change_request_id: inventoryChangeRequestId,
    settlement_method: settlementMethod,
    paid_at: paidAt,
  });
  if (ledErr) throw new Error(ledErr.message);

  // Only advance status to "paid" if the move hasn't already progressed further
  // (in_progress = 3, completed = 4 must not be regressed back to paid = 2)
  const PAST_PAID_STATUSES = new Set(["in_progress", "completed", "cancelled"]);
  const movePatch: Record<string, unknown> = {
    balance_amount: 0,
    balance_paid_at: paidAt,
    balance_method: "card",
    balance_auto_charged: settlementMethod === "auto-charge",
    payment_marked_paid: true,
    payment_marked_paid_at: paidAt,
    payment_marked_paid_by: paymentMarkedBy,
    total_paid: newTotalPaid,
    updated_at: paidAt,
  };

  if (!PAST_PAID_STATUSES.has(move.status ?? "")) {
    movePatch.status = "paid";
  }

  if (updateMoveReceiptUrl && squareReceiptUrl) {
    movePatch.square_receipt_url = squareReceiptUrl;
  }

  const { error: upErr } = await admin.from("moves").update(movePatch).eq("id", moveId);
  if (upErr) throw new Error(upErr.message);

  return { recognized, inventoryChangeRequestId };
}
