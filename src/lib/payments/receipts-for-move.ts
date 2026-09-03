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
      "entry_type, label, pre_tax_amount, hst_amount, paid_at, square_receipt_url, settlement_method",
    )
    .eq("move_id", moveId)
    .order("paid_at", { ascending: true });

  if (error || !Array.isArray(data)) {
    return { receipts: [], totalPaid: 0 };
  }

  // Scope charges write an 'adjustment' row with settlement_method='admin' and
  // a paid_at, but they COLLECT no money — they just raise the balance the
  // client owes. Counting them here overstated "total paid" on the client's
  // receipt email. Exclude them. (adjustment+card = a real extra-item charge,
  // deposit+admin = an admin-recognized deposit — both stay, they are collected.)
  const collected = data.filter(
    (row) =>
      !(
        String(row.entry_type) === "adjustment" &&
        String(row.settlement_method ?? "") === "admin"
      ),
  );

  const receipts: PaymentReceipt[] = collected.map((row) => {
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
