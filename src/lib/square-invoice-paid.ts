import { createAdminClient } from "@/lib/supabase/admin";
import { runB2BOneOffPaymentRecordedFlow } from "@/lib/b2b-delivery-payment";

export function isSquareInvoicePaidStatus(status: string | undefined): boolean {
  return String(status || "").toUpperCase() === "PAID";
}

export async function markLocalInvoicePaidFromSquare(opts: {
  supabase: ReturnType<typeof createAdminClient>;
  squareInvoiceId: string;
  squareInvoiceUrl?: string | null;
  squareReceiptUrl?: string | null;
  logContext: string;
}): Promise<void> {
  const { supabase, squareInvoiceId, logContext } = opts;

  const { data: invRow } = await supabase
    .from("invoices")
    .select("id, delivery_id, status, square_invoice_url")
    .eq("square_invoice_id", squareInvoiceId)
    .maybeSingle();

  if (!invRow?.id) {
    // Not in the generic `invoices` table — this may be a PM partner invoice,
    // which lives in `partner_invoices`. PM partners are billed via Square
    // invoices too; when the partner pays, Square fires invoice.updated and we
    // must flip the partner_invoices row to paid so the portal's outstanding
    // balance (which counts only sent/overdue) and the admin billing view both
    // stop showing it as owed — in real time, not only on the poll-reconcile.
    await markPartnerInvoicePaidFromSquare(supabase, squareInvoiceId, logContext);
    return;
  }

  if (String(invRow.status || "").toLowerCase() === "paid") {
    return;
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "paid",
    updated_at: now,
  };
  if (opts.squareInvoiceUrl) patch.square_invoice_url = opts.squareInvoiceUrl;
  if (opts.squareReceiptUrl) patch.square_receipt_url = opts.squareReceiptUrl;

  await supabase.from("invoices").update(patch).eq("id", invRow.id);

  await supabase.from("webhook_logs").insert({
    source: "square",
    event_type: `${logContext}.paid`,
    payload: { invoice_id: squareInvoiceId, delivery_id: invRow.delivery_id },
    status: "processed",
  });

  const deliveryId = invRow.delivery_id;
  if (!deliveryId) return;

  const { data: del } = await supabase
    .from("deliveries")
    .select("booking_type, organization_id")
    .eq("id", deliveryId)
    .maybeSingle();

  if (del?.booking_type !== "one_off" || del.organization_id) return;

  try {
    await runB2BOneOffPaymentRecordedFlow(deliveryId, { notifyMode: "only_if_newly_paid" });
  } catch (e) {
    console.error("[square] B2B one-off payment flow:", e);
  }
}

/**
 * PM partner invoices live in `partner_invoices` (not `invoices`) and are billed
 * to the property manager through Square. When they pay, Square fires
 * `invoice.updated` with status PAID; this flips the local partner_invoices row
 * to paid so the portal's "amount owed" (which counts only sent/overdue) and the
 * admin billing view immediately stop showing it as outstanding — without
 * waiting for the periodic poll-reconcile. Idempotent: already-paid rows and
 * ids that don't match a partner invoice are no-ops.
 */
export async function markPartnerInvoicePaidFromSquare(
  supabase: ReturnType<typeof createAdminClient>,
  squareInvoiceId: string,
  logContext: string,
): Promise<boolean> {
  const { data: pi } = await supabase
    .from("partner_invoices")
    .select("id, status, organization_id")
    .eq("square_invoice_id", squareInvoiceId)
    .maybeSingle();

  if (!pi?.id) {
    console.error(
      `[square] ${logContext}: PAID in Square but no local invoice (checked invoices + partner_invoices)`,
      { square_invoice_id: squareInvoiceId },
    );
    return false;
  }

  if (String(pi.status || "").toLowerCase() === "paid") return true;

  await supabase
    .from("partner_invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", pi.id);

  await supabase.from("webhook_logs").insert({
    source: "square",
    event_type: `${logContext}.partner_invoice_paid`,
    payload: { invoice_id: squareInvoiceId, partner_invoice_id: pi.id },
    status: "processed",
  });

  return true;
}
