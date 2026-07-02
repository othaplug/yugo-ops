import { createAdminClient } from "@/lib/supabase/admin";
import { splitOntarioTaxInclusive } from "@/lib/format-currency";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Record a move charge in move_payment_ledger (the per-transaction payment
 * record that powers the Files-section receipts and reconciliation). Best
 * effort: never throws, so it can't break the payment flow that calls it.
 *
 * `amountInclusive` is the tax-inclusive amount charged; it's split into
 * pre-tax + HST to match the ledger schema.
 *
 * `dedupeByEntryType` guards single-occurrence entries (e.g. one deposit per
 * move) so a retried finalize can't double-insert.
 */
export async function recordMovePaymentLedgerEntry(
  admin: AdminClient,
  opts: {
    moveId: string;
    entryType: string;
    label: string;
    amountInclusive: number;
    squarePaymentId?: string | null;
    squareReceiptUrl?: string | null;
    settlementMethod?: string;
    paidAt?: string | null;
    dedupeByEntryType?: boolean;
    /** When true, record the full amount as pre-tax with no HST (e.g. tips). */
    taxExempt?: boolean;
  },
): Promise<void> {
  try {
    const inclusive = Math.round((Number(opts.amountInclusive) || 0) * 100) / 100;
    if (inclusive <= 0) return;

    if (opts.dedupeByEntryType) {
      const { data: existing } = await admin
        .from("move_payment_ledger")
        .select("id")
        .eq("move_id", opts.moveId)
        .eq("entry_type", opts.entryType)
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }

    const { preTax, hst } = opts.taxExempt
      ? { preTax: inclusive, hst: 0 }
      : splitOntarioTaxInclusive(inclusive);
    await admin.from("move_payment_ledger").insert({
      move_id: opts.moveId,
      entry_type: opts.entryType,
      label: opts.label,
      pre_tax_amount: preTax,
      hst_amount: hst,
      square_payment_id: opts.squarePaymentId ?? null,
      square_receipt_url: opts.squareReceiptUrl ?? null,
      settlement_method: opts.settlementMethod ?? "client",
      paid_at: opts.paidAt ?? new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[ledger] failed to record ${opts.entryType} for move ${opts.moveId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
