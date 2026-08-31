import { createAdminClient } from "@/lib/supabase/admin";
import {
  runB2BOneOffPaymentRecordedFlow,
  runAdminMarkDeliveryPaidFlow,
  deliveryEligibleForAdminPrepaidMark,
  type B2BPaymentNotifyMode,
} from "@/lib/b2b-delivery-payment";

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

  // Flip the invoice to paid the first time we see it. If it is already paid
  // locally we still fall through to the delivery sync below: a delivery paid
  // before this sync existed (or by a run that updated the invoice but skipped
  // the delivery) can still be missing its payment_received_at, and the webhook
  // will not fire again for it.
  if (String(invRow.status || "").toLowerCase() !== "paid") {
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
  }

  if (invRow.delivery_id) {
    await syncDeliveryPaidFromInvoice(supabase, invRow.delivery_id);
  }
}

/**
 * Mirror a paid delivery invoice's state onto its linked delivery row so the ops
 * views (paid badge, revenue, dispatch) match Square. Idempotent and notify-safe.
 *
 * The pure B2B one-off flow is gated to one-offs; every OTHER B2B-style delivery
 * (category b2b, a vertical, or an org-linked retail job) uses the generalized
 * admin-mark flow. Both set deliveries.payment_received_at and run the shared
 * post-payment steps; "only_if_newly_paid" avoids re-notifying on repeat runs.
 * A delivery that is neither one-off nor B2B-eligible has no delivery-level paid
 * marker; the invoices row is its record. Shared by the Square webhook and the
 * reconcile heal pass. Before this, a paid retail/B2B invoice (e.g. DLV-30352)
 * flipped invoices.status=paid but left the delivery showing "Marked as paid".
 */
export async function syncDeliveryPaidFromInvoice(
  supabase: ReturnType<typeof createAdminClient>,
  deliveryId: string,
  notifyMode: B2BPaymentNotifyMode = "only_if_newly_paid",
): Promise<void> {
  const { data: del } = await supabase
    .from("deliveries")
    .select("booking_type, organization_id, category, vertical_code, status")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!del) return;

  const isPureOneOff = del.booking_type === "one_off" && !del.organization_id;
  try {
    if (isPureOneOff) {
      await runB2BOneOffPaymentRecordedFlow(deliveryId, { notifyMode });
    } else if (deliveryEligibleForAdminPrepaidMark(del)) {
      await runAdminMarkDeliveryPaidFlow(deliveryId, { notifyMode });
    }
  } catch (e) {
    console.error("[square] delivery payment flow:", e);
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
