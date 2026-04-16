import { formatWithHST, splitOntarioTaxInclusive } from "@/lib/format-currency";

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

/**
 * Jobs table / lists: show pre-tax + HST like invoices. If the stored effective
 * amount matches Ontario 13% inclusive with a clean pre-tax (e.g. 282.5 → 250 + HST),
 * split; otherwise treat the effective amount as pre-tax (e.g. 290 → 290 + HST).
 */
export function formatDeliveryPriceForAdminList(d: {
  final_price?: number | null;
  calculated_price?: number | null;
  override_price?: number | null;
  admin_adjusted_price?: number | null;
  total_price?: number | null;
  quoted_price?: number | null;
}): string {
  const raw = effectiveDeliveryPrice(d);
  if (raw <= 0) return "—";
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
  const preForLine = matchesInclusive ? preRounded : raw;
  return formatWithHST(preForLine);
}
