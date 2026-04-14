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
    console.error(`[square] ${logContext}: PAID in Square but no local invoice with square_invoice_id`, {
      square_invoice_id: squareInvoiceId,
    });
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
