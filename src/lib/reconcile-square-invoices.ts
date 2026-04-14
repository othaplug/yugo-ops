import { squareClient } from "@/lib/square";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDeliveryNumber } from "@/lib/delivery-number";
import { opsInvoiceNumberForSquareJob } from "@/lib/invoice-display-number";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { isSquareInvoicePaidStatus, markLocalInvoicePaidFromSquare } from "@/lib/square-invoice-paid";

/** Same canonical form we store and Square shows (DLV-xxxx, M-…). */
function canonicalSquareInvoiceNumber(raw: string | null | undefined): string {
  const t = String(raw || "").trim();
  if (!t) return "";
  if (/^M-/i.test(t)) {
    return opsInvoiceNumberForSquareJob({
      jobType: "move",
      referenceCode: t.replace(/^M-/i, ""),
    });
  }
  return normalizeDeliveryNumber(t);
}

type InvoiceRowMissingSquare = {
  id: string;
  invoice_number?: string | null;
  deliveries?: { delivery_number?: string | null } | { delivery_number?: string | null }[] | null;
  moves?: { move_code?: string | null } | { move_code?: string | null }[] | null;
};

/** Prefer job id from delivery/move so we still match DLV-xxxx when invoice_number is a legacy INV-xxxx. */
function referenceTextForSquareLookup(row: InvoiceRowMissingSquare): string {
  const d = row.deliveries;
  const del = Array.isArray(d) ? d[0] : d;
  if (del?.delivery_number) return String(del.delivery_number).trim();
  const m = row.moves;
  const mov = Array.isArray(m) ? m[0] : m;
  if (mov?.move_code) return String(mov.move_code).trim();
  return String(row.invoice_number || "").trim();
}

/**
 * Walk Square invoice list for this location until we find an invoice whose public number matches.
 * Used when Ops row is missing square_invoice_id but invoice_number matches Square (e.g. DLV-9057).
 */
async function findSquareInvoiceIdByPublicNumber(expectedCanon: string): Promise<string | null> {
  if (!expectedCanon) return null;
  const { locationId } = await getSquarePaymentConfig();
  if (!locationId) return null;

  const want = expectedCanon.trim().toUpperCase();
  const page = await squareClient.invoices.list({ locationId, limit: 100 });
  let scanned = 0;
  const maxScan = 8000;

  for await (const inv of page) {
    scanned++;
    if (scanned > maxScan) break;
    const num = (inv.invoiceNumber || "").trim();
    if (!num) continue;
    const canon = canonicalSquareInvoiceNumber(num);
    if (canon.toUpperCase() === want || num.toUpperCase() === want) {
      return inv.id ?? null;
    }
  }
  return null;
}

/**
 * Poll Square for invoices not in a terminal Ops state and mark paid when Square reports PAID.
 * Includes rows missing square_invoice_id if invoice_number can be matched in Square (DLV-xxxx / M-…).
 */
export async function reconcileUnpaidSquareInvoices(
  supabase: ReturnType<typeof createAdminClient>,
  opts: { limit?: number } = {},
): Promise<{ checked: number; markedPaid: number; linkedIds: number; errors: string[] }> {
  const limit = Math.min(Math.max(opts.limit ?? 80, 1), 200);
  const errors: string[] = [];

  if (!(process.env.SQUARE_ACCESS_TOKEN || "").trim()) {
    return { checked: 0, markedPaid: 0, linkedIds: 0, errors: ["SQUARE_ACCESS_TOKEN not set"] };
  }

  const { data: withSquareId, error: err1 } = await supabase
    .from("invoices")
    .select("id, square_invoice_id, status, invoice_number")
    .not("square_invoice_id", "is", null)
    .not("status", "in", '("paid","cancelled","archived")')
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (err1) {
    return { checked: 0, markedPaid: 0, linkedIds: 0, errors: [err1.message] };
  }

  const { data: missingSquareId, error: err2 } = await supabase
    .from("invoices")
    .select(
      "id, square_invoice_id, status, invoice_number, delivery_id, move_id, deliveries!delivery_id(delivery_number), moves!move_id(move_code)",
    )
    .is("square_invoice_id", null)
    .not("status", "in", '("paid","cancelled","archived")')
    .order("updated_at", { ascending: true })
    .limit(Math.min(40, limit));

  if (err2) {
    return { checked: 0, markedPaid: 0, linkedIds: 0, errors: [err2.message] };
  }

  const rowsWithId = withSquareId ?? [];
  const rowsMissing = missingSquareId ?? [];
  let markedPaid = 0;
  let linkedIds = 0;
  let checked = rowsWithId.length + rowsMissing.length;

  for (const row of rowsWithId) {
    const squareInvoiceId = (row.square_invoice_id as string | null)?.trim();
    if (!squareInvoiceId) continue;

    try {
      const res = await squareClient.invoices.get({ invoiceId: squareInvoiceId });
      const inv = res.invoice;
      const status = inv?.status as string | undefined;
      if (!isSquareInvoicePaidStatus(status)) continue;

      const publicUrl = (inv as { publicUrl?: string | null } | undefined)?.publicUrl ?? null;

      await markLocalInvoicePaidFromSquare({
        supabase,
        squareInvoiceId,
        squareInvoiceUrl: publicUrl,
        squareReceiptUrl: null,
        logContext: "reconcile",
      });
      markedPaid++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${squareInvoiceId}: ${msg}`);
      console.error("[reconcile-square-invoices] invoices.get failed:", squareInvoiceId, e);
    }
  }

  for (const row of rowsMissing) {
    const refText = referenceTextForSquareLookup(row as InvoiceRowMissingSquare);
    const expected = canonicalSquareInvoiceNumber(refText);
    if (!expected) continue;

    try {
      const foundId = await findSquareInvoiceIdByPublicNumber(expected);
      if (!foundId) {
        errors.push(`lookup ${expected}: not found in recent Square invoices for this location`);
        continue;
      }

      await supabase.from("invoices").update({ square_invoice_id: foundId }).eq("id", row.id);
      linkedIds++;

      const res = await squareClient.invoices.get({ invoiceId: foundId });
      const inv = res.invoice;
      if (!isSquareInvoicePaidStatus(inv?.status as string | undefined)) continue;

      const publicUrl = (inv as { publicUrl?: string | null } | undefined)?.publicUrl ?? null;

      await markLocalInvoicePaidFromSquare({
        supabase,
        squareInvoiceId: foundId,
        squareInvoiceUrl: publicUrl,
        squareReceiptUrl: null,
        logContext: "reconcile",
      });
      markedPaid++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${refText || "?"}: ${msg}`);
      console.error("[reconcile-square-invoices] orphan row failed:", row.id, e);
    }
  }

  return { checked, markedPaid, linkedIds, errors };
}
