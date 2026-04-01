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
