import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/** A payment receipt rendered as a document row on the track / admin Files section. */
export type LedgerReceiptDoc = {
  id: string;
  type: "receipt";
  title: string;
  view_url: string | null;
  external_url: string | null;
  created_at: string;
};

/** Human labels per move_payment_ledger entry_type. */
const RECEIPT_LABEL: Record<string, string> = {
  deposit: "Deposit receipt",
  balance: "Final payment receipt",
  inventory_change: "Change adjustment receipt",
  adjustment: "Additional charge receipt",
  tip: "Tip receipt",
  supplies: "Supplies receipt",
};

/**
 * Build one labelled receipt document per move_payment_ledger entry that has a
 * Square receipt URL (deposit, balance, tips, supplies, adjustments). Falls back
 * to the single moves.square_receipt_url for legacy moves that predate the
 * ledger, so no move ever loses its receipt link.
 */
export async function buildLedgerReceiptDocs(
  admin: AdminClient,
  moveId: string,
  fallbackReceiptUrl: string | null,
): Promise<LedgerReceiptDoc[]> {
  // Return every ledger entry — including rows that have no Square receipt
  // URL yet — so the customer sees a full payment record and doesn't
  // wonder where their deposit went. Rows without a URL still render as
  // "Deposit receipt ($X.XX)" with no Download button (guarded in the UI
  // by `{url && ...}`), which is a better signal than an empty Files tab.
  const { data: rows } = await admin
    .from("move_payment_ledger")
    .select(
      "id, entry_type, label, pre_tax_amount, hst_amount, square_receipt_url, paid_at",
    )
    .eq("move_id", moveId)
    .order("paid_at", { ascending: true });

  const docs: LedgerReceiptDoc[] = (rows ?? []).map((r) => {
    const amount =
      (Number(r.pre_tax_amount) || 0) + (Number(r.hst_amount) || 0);
    const base = RECEIPT_LABEL[String(r.entry_type)] ?? "Payment receipt";
    const amt = amount > 0 ? ` ($${amount.toFixed(2)})` : "";
    const url = (r.square_receipt_url as string | null) ?? null;
    return {
      id: `ledger-${r.id}`,
      type: "receipt" as const,
      title: `${base}${amt}`,
      view_url: url,
      external_url: url,
      created_at: (r.paid_at as string) ?? new Date().toISOString(),
    };
  });

  if (docs.length === 0 && fallbackReceiptUrl) {
    docs.push({
      id: "square-receipt",
      type: "receipt",
      title: "Payment receipt",
      view_url: fallbackReceiptUrl,
      external_url: fallbackReceiptUrl,
      created_at: new Date().toISOString(),
    });
  }

  return docs;
}
