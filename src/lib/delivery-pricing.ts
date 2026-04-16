import {
  calcHST,
  formatWithHST,
  splitOntarioTaxInclusive,
} from "@/lib/format-currency";

/**
 * Effective amount for admin/reporting when legacy columns coexist with
 * calculated_price / override_price / final_price (generated).
 */
export function effectiveDeliveryPrice(d: {
  final_price?: number | null;
  calculated_price?: number | null;
  override_price?: number | null;
  admin_adjusted_price?: number | null;
  total_price?: number | null;
  quoted_price?: number | null;
}): number {
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const fp = n(d.final_price);
  if (fp > 0) return fp;
  const op = n(d.override_price);
  if (op > 0) return op;
  const cp = n(d.calculated_price);
  if (cp > 0) return cp;
  const ap = n(d.admin_adjusted_price);
  if (ap > 0) return ap;
  const tp = n(d.total_price);
  if (tp > 0) return tp;
  return n(d.quoted_price);
}

export type DeliveryPriceFields = Parameters<typeof effectiveDeliveryPrice>[0];

/**
 * Same pre-tax figure used on Jobs → All Deliveries and Finance when a delivery row
 * is the source of truth (handles tax-inclusive stored totals vs pre-tax).
 */
export function deliveryPreTaxForAdminList(d: DeliveryPriceFields): number {
  const raw = effectiveDeliveryPrice(d);
  if (raw <= 0) return 0;
  const { preTax, inclusive } = splitOntarioTaxInclusive(raw);
  const preRounded = Math.round(preTax * 100) / 100;
  const wholeOrHalf =
    Math.abs(preRounded - Math.round(preRounded)) < 0.02 ||
    Math.abs(preRounded * 2 - Math.round(preRounded * 2)) < 0.02;
  const recon = Math.round(preRounded * 1.13 * 100) / 100;
  const matchesInclusive =
    Math.abs(inclusive - raw) < 0.02 &&
    wholeOrHalf &&
    Math.abs(recon - raw) < 0.06;
  return matchesInclusive ? preRounded : raw;
}

function deliveryEmbedRow(inv: { deliveries?: unknown }): DeliveryPriceFields | null {
  const d = inv.deliveries;
  const row = Array.isArray(d) ? d[0] : d;
  if (!row || typeof row !== "object") return null;
  return row as DeliveryPriceFields;
}

/**
 * Pre-tax amount for an invoice row: linked delivery pricing when present, else `amount`.
 * Matches Jobs table pricing for DLV-linked invoices.
 */
export function invoicePreTaxForDisplay(inv: {
  amount?: unknown;
  delivery_id?: string | null;
  deliveries?: unknown;
}): number {
  const row = deliveryEmbedRow(inv);
  if (row && inv.delivery_id) {
    const pre = deliveryPreTaxForAdminList(row);
    if (pre > 0) return pre;
  }
  const n = Number(inv.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Gross (pre-tax + Ontario HST) for Finance KPIs when pre-tax comes from `invoicePreTaxForDisplay`. */
export function invoiceGrossForDisplay(inv: {
  amount?: unknown;
  delivery_id?: string | null;
  deliveries?: unknown;
}): number {
  const pre = invoicePreTaxForDisplay(inv);
  return pre + calcHST(pre);
}

/**
 * Jobs table / lists: show pre-tax + HST like invoices. If the stored effective
 * amount matches Ontario 13% inclusive with a clean pre-tax (e.g. 282.5 → 250 + HST),
 * split; otherwise treat the effective amount as pre-tax (e.g. 290 → 290 + HST).
 */
export function formatDeliveryPriceForAdminList(d: DeliveryPriceFields): string {
  const pre = deliveryPreTaxForAdminList(d);
  if (pre <= 0) return "—";
  return formatWithHST(pre);
}

