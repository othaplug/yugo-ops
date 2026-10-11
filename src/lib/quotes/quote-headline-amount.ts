/**
 * THE canonical "what this quote is worth" number — the single figure shown in
 * the Ops Quotes list and the one every HubSpot deal `amount` must mirror, so
 * Ops and HubSpot never drift. Defined once here and reused by the list, the
 * HubSpot sync write-paths, the reconciliation sweep and the daily cron.
 *
 * Rule (confirmed by operator 2026-10-11): match the Ops Quotes list exactly —
 * the client-facing, tax-INCLUSIVE figure.
 *   1. custom_price  — non-tiered quotes (white_glove, event, single_item,
 *      labour_only). Stored as a bare number; legacy rows may be {price|total}.
 *   2. tiers[recommended_tier].total — tiered quotes (local_move, long_distance,
 *      office). `.total` is tax-inclusive (what the client sees); never `.price`
 *      (pre-tax) — that was the ~13% HST drift on every tiered deal in HubSpot.
 *   3. first tier with a total — legacy quotes with no recommended_tier.
 *
 * Returns a whole dollar number, or null when the quote carries no priced
 * figure yet (draft with no tiers/custom price).
 */
export function quoteHeadlineAmount(
  quote: {
    custom_price?: unknown;
    tiers?: unknown;
    recommended_tier?: unknown;
  } | null | undefined,
): number | null {
  if (!quote) return null;

  const cp = quote.custom_price;
  if (typeof cp === "number" && Number.isFinite(cp) && cp > 0) return Math.round(cp);
  if (cp && typeof cp === "object") {
    const o = cp as { price?: unknown; total?: unknown };
    // Prefer the tax-inclusive total when a legacy object shape carries both.
    const v = [o.total, o.price].find((x) => typeof x === "number" && Number.isFinite(x) && (x as number) > 0);
    if (typeof v === "number") return Math.round(v);
  }

  const tiers = quote.tiers;
  if (tiers && typeof tiers === "object" && !Array.isArray(tiers)) {
    const map = tiers as Record<string, { total?: unknown; price?: unknown } | undefined>;
    const rec = String(quote.recommended_tier ?? "signature").toLowerCase().trim();
    const pickTotal = (t: { total?: unknown; price?: unknown } | undefined): number | null => {
      if (!t) return null;
      // Tax-inclusive total is the Ops-list figure; fall back to price only when
      // a tier genuinely has no total (shouldn't happen on a real quote).
      const v = [t.total, t.price].find((x) => typeof x === "number" && Number.isFinite(x) && (x as number) > 0);
      return typeof v === "number" ? Math.round(v) : null;
    };
    const fromRec = pickTotal(map[rec]);
    if (fromRec != null) return fromRec;
    for (const k of Object.keys(map)) {
      const v = pickTotal(map[k]);
      if (v != null) return v;
    }
  }

  return null;
}

/**
 * The two figures a HubSpot deal needs, derived from ONE source so Ops and
 * HubSpot never diverge:
 *   - `amount`   — the main deal value field = the Ops-list, tax-INCLUSIVE
 *     headline (quoteHeadlineAmount). This is the number the operator compares.
 *   - `subtotal` — the PRE-tax basis for the secondary OPS+ props
 *     (sub_total/taxes/total_price, which buildAllDealProperties derives by
 *     ×1.13). Uses the recommended tier's pre-tax `.price` when present, else
 *     backs it out of the tax-inclusive amount (HST 13%).
 * Every deal-amount write path (quote send, regenerate, hourly reconcile cron,
 * one-off sweep) uses this, so the main Amount field always equals the Ops list.
 */
export function quoteDealFinancials(
  quote: {
    custom_price?: unknown;
    tiers?: unknown;
    recommended_tier?: unknown;
  } | null | undefined,
): { amount: number | null; subtotal: number | null } {
  const amount = quoteHeadlineAmount(quote);
  if (amount == null) return { amount: null, subtotal: null };

  let subtotal = Math.round(amount / 1.13); // default: back HST out of the total
  const tiers = quote?.tiers;
  if (tiers && typeof tiers === "object" && !Array.isArray(tiers)) {
    const map = tiers as Record<string, { price?: unknown } | undefined>;
    const rec = String(quote?.recommended_tier ?? "signature").toLowerCase().trim();
    const recPrice = map[rec]?.price;
    if (typeof recPrice === "number" && Number.isFinite(recPrice) && recPrice > 0) {
      subtotal = Math.round(recPrice);
    }
  }
  return { amount, subtotal };
}
