import { contractTaxFromMove } from "@/lib/format-currency";
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
 * A quote's PRE-TAX (HST-exclusive) deal value, for the HubSpot deal `amount`.
 * Operator directive (2026-10-11): HubSpot is HST-exclusive and consistent.
 *   - tiered  -> tiers[recommended_tier].price  (pre-tax; `.total` is tax-incl)
 *   - custom  -> custom_price (white_glove/event/single_item — already pre-tax)
 * This is DIFFERENT from quoteHeadlineAmount (tax-inclusive, Ops-list display).
 * Used only for quotes that are NOT yet booked; once a move exists the move is
 * the source of truth — see movePreTaxAmount.
 */
export function quotePreTaxAmount(
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
    // custom_price objects carry a pre-tax `price`; `total` is tax-inclusive.
    const v = [o.price, o.total].find((x) => typeof x === "number" && Number.isFinite(x) && (x as number) > 0);
    if (typeof v === "number") return Math.round(v);
  }
  const tiers = quote.tiers;
  if (tiers && typeof tiers === "object" && !Array.isArray(tiers)) {
    const map = tiers as Record<string, { price?: unknown; total?: unknown } | undefined>;
    const rec = String(quote.recommended_tier ?? "signature").toLowerCase().trim();
    const pick = (t: { price?: unknown; total?: unknown } | undefined): number | null => {
      if (!t) return null;
      const v = typeof t.price === "number" && t.price > 0 ? t.price : undefined;
      return typeof v === "number" ? Math.round(v) : null;
    };
    const fromRec = pick(map[rec]);
    if (fromRec != null) return fromRec;
    for (const k of Object.keys(map)) {
      const v = pick(map[k]);
      if (v != null) return v;
    }
  }
  return null;
}

/**
 * A BOOKED move's current PRE-TAX contract amount — the ONE authoritative
 * figure once a quote is booked (HubSpot, moves list, profitability, revenue
 * all read this). Delegates to `contractTaxFromMove` so there is a single
 * definition of a move's contract total across the whole app.
 *
 * IMPORTANT: `final_amount` / `total_price` are stored TAX-INCLUSIVE (that's how
 * the charge routes write them), and `estimate` is the pre-tax base; contractTax
 * FromMove handles that correctly (anchors on estimate+HST, splits HST out of an
 * edited final_amount/total_price). A naive `final_amount ?? total_price ??
 * estimate` would treat a tax-inclusive edited total as pre-tax and overstate.
 * The pre-tax contract must include add-ons — `estimate` is bumped by the
 * add-on fold at booking and by every charge route.
 */
export function movePreTaxAmount(
  move:
    | { final_amount?: unknown; total_price?: unknown; estimate?: unknown; amount?: unknown }
    | null
    | undefined,
): number | null {
  if (!move) return null;
  const { preTax } = contractTaxFromMove({
    estimate: move.estimate as number | string | null | undefined,
    final_amount: move.final_amount as number | string | null | undefined,
    total_price: move.total_price as number | string | null | undefined,
    amount: move.amount as number | string | null | undefined,
  });
  return preTax > 0 ? Math.round(preTax) : null;
}

/**
 * The two figures a HubSpot deal needs for a QUOTE (not yet booked), both
 * PRE-TAX: `amount` is the main deal value, `subtotal` is the same pre-tax basis
 * that buildAllDealProperties uses to derive sub_total/taxes/total_price (×1.13).
 */
export function quoteDealFinancials(
  quote: {
    custom_price?: unknown;
    tiers?: unknown;
    recommended_tier?: unknown;
  } | null | undefined,
): { amount: number | null; subtotal: number | null } {
  const amount = quotePreTaxAmount(quote);
  return { amount, subtotal: amount };
}
