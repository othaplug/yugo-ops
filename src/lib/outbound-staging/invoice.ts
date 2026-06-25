/**
 * Outbound staging — auto-invoice on completion.
 *
 * When a shipment hits 'completed', this module sends a Square invoice to
 * the partner contact email for the total stored on the row. We reuse the
 * existing createAndPublishSquareInvoice helper so partner billing flows
 * through the same Square Customer / order / publish pipeline as B2B
 * deliveries — same INV-… numbering, same payment reminders, same
 * banking + e-transfer copy.
 *
 * Idempotent: refuses to re-invoice a shipment that already has
 * invoice_sent=true. If Square ever returns an error, we mark the row
 * with the failure detail in internal_notes so a coordinator can retry
 * manually without losing context.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createAndPublishSquareInvoice } from "@/lib/square-invoice";

export type OutboundInvoiceResult =
  | { ok: true; invoice_id: string; square_invoice_id: string; invoice_url: string | null }
  | { ok: false; reason: string; skipped?: boolean };

export async function sendOutboundShipmentInvoice(
  shipmentId: string,
): Promise<OutboundInvoiceResult> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("outbound_shipments")
    .select("*")
    .eq("id", shipmentId)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, reason: "Shipment not found" };
  }

  if (row.invoice_sent) {
    return {
      ok: false,
      skipped: true,
      reason: `Invoice already sent (square_invoice_id=${row.square_invoice_id ?? "—"})`,
    };
  }

  const total = Number(row.total_price ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ok: false,
      reason: "No total_price stored on shipment row — refusing to invoice $0",
    };
  }

  const partnerEmail = String(row.partner_contact_email ?? "").trim();
  if (!partnerEmail) {
    return {
      ok: false,
      reason: "No partner_contact_email — Square invoice needs a recipient",
    };
  }

  // Map outbound fields onto the shared invoice helper's shape. The helper
  // is delivery-shaped under the hood (deliveryId / deliveryNumber); we
  // pass the shipment id + shipment_number so the Square invoice number
  // comes out as INV-OS-NNNNN, matching the rest of the document trail.
  try {
    const result = await createAndPublishSquareInvoice({
      deliveryId: row.id,
      deliveryNumber: row.shipment_number,
      customerName: row.partner_name || row.business_name || "Partner",
      deliveryAddress: row.consignor_address || "Pickup at consignor",
      amount: total,
      orgEmail: partnerEmail,
      orgName: row.partner_name || row.business_name || "Partner",
      contactName: row.partner_contact_name || row.partner_name || "Partner",
      jobType: "delivery",
      partnerVertical: "custom",
      moveCode: row.shipment_number,
    });

    if (!result?.squareInvoiceId) {
      const reason = "Square returned no invoice id";
      await admin
        .from("outbound_shipments")
        .update({
          internal_notes: appendNote(
            String(row.internal_notes ?? ""),
            `[invoice] failed: ${reason}`,
          ),
        })
        .eq("id", row.id);
      return { ok: false, reason };
    }

    await admin
      .from("outbound_shipments")
      .update({
        invoice_sent: true,
        invoice_sent_at: new Date().toISOString(),
        invoice_id: result.invoiceNumber,
        square_invoice_id: result.squareInvoiceId,
      })
      .eq("id", row.id);

    return {
      ok: true,
      invoice_id: result.invoiceNumber,
      square_invoice_id: result.squareInvoiceId,
      invoice_url: result.squareInvoiceUrl,
    };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Unknown invoice error";
    await admin
      .from("outbound_shipments")
      .update({
        internal_notes: appendNote(
          String(row.internal_notes ?? ""),
          `[invoice] threw: ${reason.slice(0, 300)}`,
        ),
      })
      .eq("id", row.id);
    return { ok: false, reason };
  }
}

function appendNote(existing: string, line: string): string {
  const ts = new Date().toISOString();
  const newLine = `[${ts}] ${line}`;
  return existing.trim() ? `${existing.trim()}\n\n${newLine}` : newLine;
}
