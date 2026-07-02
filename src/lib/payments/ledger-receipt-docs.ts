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
  const { data: rows } = await admin
    .from("move_payment_ledger")
    .select(
      "id, entry_type, label, pre_tax_amount, hst_amount, square_receipt_url, paid_at",
    )
    .eq("move_id", moveId)
    .not("square_receipt_url", "is", null)
    .order("paid_at", { ascending: true });

  const docs: LedgerReceiptDoc[] = (rows ?? [])
    .filter((r) => !!r.square_receipt_url)
    .map((r) => {
      const amount =
        (Number(r.pre_tax_amount) || 0) + (Number(r.hst_amount) || 0);
      const base = RECEIPT_LABEL[String(r.entry_type)] ?? "Payment receipt";
      const amt = amount > 0 ? ` ($${amount.toFixed(2)})` : "";
      const url = r.square_receipt_url as string;
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
