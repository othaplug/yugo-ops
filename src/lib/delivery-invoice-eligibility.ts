import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";

/**
 * The row shape the bulk-invoice eligibility check needs. A superset of the
 * pricing fields plus the gating signals: booking type, partner org, invoice
 * coverage (`has_invoice`, stamped server-side because the client can't join
 * the invoices table), and business contact email.
 */
export type DeliveryInvoiceEligibilityRow = {
  booking_type?: string | null;
  organization_id?: string | null;
  has_invoice?: boolean | null;
  contact_email?: string | null;
  final_price?: number | null;
  calculated_price?: number | null;
  override_price?: number | null;
  admin_adjusted_price?: number | null;
  total_price?: number | null;
  quoted_price?: number | null;
};

export type InvoiceIneligibleReason =
  | "already_invoiced"
  | "partner_billed"
  | "no_contact_email"
  | "no_price";

/**
 * Can a bulk "Send invoices" run create AND send a Square invoice for this
 * delivery? Mirrors the server gates in sendB2BOneOffDeliveryInvoice so the
 * pre-send preview count matches what the server will actually do. Returns
 * null when eligible, otherwise the reason it will be skipped.
 *
 * Kept in sync with sendB2BOneOffDeliveryInvoice: any gate added there must be
 * reflected here (and vice versa) or the preview will mislead.
 */
export function deliveryBulkInvoiceIneligibleReason(
  row: DeliveryInvoiceEligibilityRow,
): InvoiceIneligibleReason | null {
  if (row.has_invoice) return "already_invoiced";
  if (row.booking_type !== "one_off" || row.organization_id) return "partner_billed";
  if (!(row.contact_email || "").trim()) return "no_contact_email";
  if (effectiveDeliveryPrice(row) <= 0) return "no_price";
  return null;
}

export function isDeliveryEligibleForBulkInvoice(
  row: DeliveryInvoiceEligibilityRow,
): boolean {
  return deliveryBulkInvoiceIneligibleReason(row) === null;
}

/** Human-facing copy for each ineligible reason (used in the preview breakdown). */
export const INVOICE_INELIGIBLE_LABEL: Record<InvoiceIneligibleReason, string> = {
  already_invoiced: "already invoiced",
  partner_billed: "partner-billed (invoiced via statements)",
  no_contact_email: "no business contact email",
  no_price: "no price set",
};
