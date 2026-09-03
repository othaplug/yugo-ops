import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * B2B commercial quotes carry the operator-selected invoice term in
 * `factors_applied.b2b_invoice_terms` (net_15 | net_30 | on_completion). The
 * invoice-raising routes used to ignore this and fall back to the org default
 * (Net 30) or due-on-receipt, so a quote sold as Net 15 was invoiced Net 30.
 * This resolves the job-level term back to a due-day count so the invoice
 * honors exactly what the client was quoted.
 */

/** net_15 -> 15, net_30 -> 30, on_completion -> 0 (due on receipt), unknown -> null. */
export function invoiceDueDaysFromTerm(term: string | null | undefined): number | null {
  const t = String(term ?? "").trim().toLowerCase();
  if (t === "net_15") return 15;
  if (t === "net_30") return 30;
  if (t === "on_completion") return 0;
  return null;
}

/**
 * Read the job-level invoice term from the delivery's source quote. Returns the
 * due-day count (0 = due on receipt) or null when the quote sets no explicit
 * term (caller should then fall back to org / route default).
 */
export async function resolveQuoteInvoiceDueDays(
  admin: SupabaseClient,
  sourceQuoteId: string | null | undefined,
): Promise<number | null> {
  const id = String(sourceQuoteId ?? "").trim();
  if (!id) return null;
  const { data } = await admin
    .from("quotes")
    .select("factors_applied")
    .eq("id", id)
    .maybeSingle();
  const factors = (data?.factors_applied ?? {}) as Record<string, unknown>;
  const term =
    typeof factors.b2b_invoice_terms === "string" ? factors.b2b_invoice_terms : null;
  return invoiceDueDaysFromTerm(term);
}
