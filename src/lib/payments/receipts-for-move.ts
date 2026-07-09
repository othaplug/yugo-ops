import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentReceipt {
  label: string;
  amount: number;
  paidAt: string | null;
  receiptUrl: string | null;
  /** Ledger entry_type — helps the email template put deposit first */
  entryType: string;
}

/**
 * Return every completed payment on a move (deposit, balance, tips, extras),
 * newest-last, so the customer's balance-paid email can show BOTH the
 * deposit receipt and the balance receipt with a running total instead of a
 * single mystery amount. Sourced from `move_payment_ledger` which is the
 * authoritative per-transaction record.
 */
export async function fetchPaymentReceiptsForMove(
  supabase: SupabaseClient,
  moveId: string,
): Promise<{ receipts: PaymentReceipt[]; totalPaid: number }> {
  const { data, error } = await supabase
    .from("move_payment_ledger")
    .select(
      "entry_type, label, pre_tax_amount, hst_amount, paid_at, square_receipt_url",
    )
    .eq("move_id", moveId)
    .order("paid_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return { receipts: [], totalPaid: 0 };
  }

  const receipts: PaymentReceipt[] = data.map((row) => {
    const pre = Number(row.pre_tax_amount || 0);
    const hst = Number(row.hst_amount || 0);
    return {
      label: String(row.label || row.entry_type || "Payment"),
      amount: Math.round((pre + hst) * 100) / 100,
      paidAt: row.paid_at ?? null,
      receiptUrl: row.square_receipt_url ?? null,
      entryType: String(row.entry_type || ""),
    };
  });

  const totalPaid =
    Math.round(receipts.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;

  return { receipts, totalPaid };
}
