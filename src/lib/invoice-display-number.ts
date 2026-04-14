import { normalizeDeliveryNumber } from "@/lib/delivery-number";

/**
 * Matches Square `invoiceNumber` in {@link createAndPublishSquareInvoice}
 * (delivery = DLV-xxxx from delivery number; move = M- + sanitized move code).
 */
export function opsInvoiceNumberForSquareJob(opts: {
  jobType: "delivery" | "move";
  /** Delivery: `delivery_number`. Move: `move_code` (same field Square uses for the M- prefix). */
  referenceCode: string | null | undefined;
}): string {
  if (opts.jobType === "move") {
    const raw = String(opts.referenceCode || "").trim() || "MOVE";
    return `M-${raw.replace(/[^A-Za-z0-9-]/g, "").slice(0, 24)}`;
  }
  return normalizeDeliveryNumber(opts.referenceCode);
}

type InvoiceRowForDisplay = {
  invoice_number?: string | null;
  deliveries?:
    | { delivery_number?: string | null }
    | Array<{ delivery_number?: string | null }>
    | null;
  moves?: { move_code?: string | null } | Array<{ move_code?: string | null }> | null;
};

/** Prefer job id aligned with Square; fall back to stored `invoice_number`. */
export function displayInvoiceNumber(inv: InvoiceRowForDisplay): string {
  const del = Array.isArray(inv.deliveries) ? inv.deliveries[0] : inv.deliveries;
  const mov = Array.isArray(inv.moves) ? inv.moves[0] : inv.moves;
  if (del?.delivery_number) {
    return normalizeDeliveryNumber(del.delivery_number);
  }
  if (mov?.move_code) {
    return opsInvoiceNumberForSquareJob({
      jobType: "move",
      referenceCode: mov.move_code,
    });
  }
  return String(inv.invoice_number || "").trim() || "—";
}
