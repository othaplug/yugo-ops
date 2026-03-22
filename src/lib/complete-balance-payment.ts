import { createAdminClient } from "@/lib/supabase/admin";
import { calcHST } from "@/lib/format-currency";

export type AdminClient = ReturnType<typeof createAdminClient>;

export type BalanceSettlementMethod = "card" | "etransfer" | "auto-charge" | "client" | "admin";

/** E-transfer address shown to clients when no card on file */
export const CLIENT_ETRANSFER_EMAIL = "pay@helloyugo.com";

export async function findInventoryChangeForBalancePayment(
  admin: AdminClient,
  moveId: string,
  balancePreTax: number,
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
  if (Math.abs(Number(data.additional_deposit_required) - balancePreTax) <= 0.05) return data.id as string;
  return null;
}

/**
 * After a successful balance / adjustment collection, append ledger row and update move.
 * `balancePreTax` must match `move.balance_amount` before clearing (inventory delta or open balance).
 */
export async function finalizeBalancePaymentSettlement(opts: {
  admin: AdminClient;
  moveId: string;
  balancePreTax: number;
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
    balancePreTax,
    squarePaymentId,
    squareReceiptUrl,
    settlementMethod,
    paymentMarkedBy,
    updateMoveReceiptUrl = false,
  } = opts;

  const preTax = Math.round(balancePreTax * 100) / 100;
  const hst = calcHST(preTax);
  const recognized = Math.round((preTax + hst) * 100) / 100;
  const inventoryChangeRequestId = await findInventoryChangeForBalancePayment(admin, moveId, preTax);
  const label = inventoryChangeRequestId ? "Change request adjustment" : "Balance payment";
  const entryType = inventoryChangeRequestId ? "inventory_change" : "balance";

  const { data: move, error: moveErr } = await admin.from("moves").select("total_paid, amount").eq("id", moveId).single();
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

  const movePatch: Record<string, unknown> = {
    balance_amount: 0,
    balance_paid_at: paidAt,
    balance_method: settlementMethod === "etransfer" ? "etransfer" : "card",
    balance_auto_charged: settlementMethod === "auto-charge",
    status: "paid",
    payment_marked_paid: true,
    payment_marked_paid_at: paidAt,
    payment_marked_paid_by: paymentMarkedBy,
    total_paid: newTotalPaid,
    updated_at: paidAt,
  };

  if (updateMoveReceiptUrl && squareReceiptUrl) {
    movePatch.square_receipt_url = squareReceiptUrl;
  }

  const { error: upErr } = await admin.from("moves").update(movePatch).eq("id", moveId);
  if (upErr) throw new Error(upErr.message);

  return { recognized, inventoryChangeRequestId };
}
