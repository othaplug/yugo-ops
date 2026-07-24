/**
 * Curated reasons a coordinator might override a quote's engine-computed
 * price (either per-tier or the global pre-tax total).
 *
 * Different intent from `quote-update-reasons.ts` — that one explains
 * WHY the operator is re-issuing the quote to the client. This one
 * explains WHY the price was hand-set. Both are logged and surface
 * in audit trails; they live in distinct dropdowns on the edit page.
 */
/**
 * Grouped so the operator can scan the list by intent (are we going
 * DOWN in price, UP in price, or CORRECTING). The `<select>` renders
 * them flat since native selects don't do groups cleanly, but the
 * ordering below preserves the logical grouping visually.
 *
 * Revised 2026-07-XX after operator flagged the previous list as
 * incomplete — missing premium reasons (rush, added scope) which
 * meant operators writing overrides UP had nothing to select and
 * fell back to "Other" every time.
 */
export const PRICE_OVERRIDE_REASONS = [
  // ── Discounts (price going DOWN) ─────────────────────────────
  { value: "competitive_match",       label: "Competitive match" },
  { value: "loyalty_repeat",          label: "Loyalty / repeat customer" },
  { value: "corporate_partner",       label: "Corporate / partner rate" },
  { value: "realtor_referral",        label: "Realtor / referral courtesy" },
  { value: "off_peak_filler",         label: "Off-peak / filler booking discount" },
  { value: "retention",               label: "Retention (avoid cancellation)" },
  { value: "scope_reduction",         label: "Scope reduction (client removed items)" },
  { value: "promo_campaign",          label: "Promotional / campaign price" },
  { value: "goodwill_adjustment",     label: "Goodwill adjustment" },
  // ── Premiums (price going UP) ────────────────────────────────
  { value: "rush_short_notice",       label: "Rush / short-notice premium" },
  { value: "complexity_not_modelled", label: "Complexity not in engine (stairs, access, heavy items)" },
  { value: "scope_addition",          label: "Scope addition (client added items)" },
  { value: "insurance_inclusion",     label: "Additional insurance / coverage included" },
  // ── Corrections ──────────────────────────────────────────────
  { value: "manual_correction",       label: "Manual correction (engine misread)" },
  { value: "pm_contract_rate",        label: "PM / contract fixed rate" },
  // ── Fallback ─────────────────────────────────────────────────
  { value: "other",                   label: "Other (write your own)" },
] as const;

/**
 * Legacy codes we historically stored. Kept mapped so any existing
 * `quotes.override_reason` rows continue to render a human label
 * instead of a raw slug in audits and admin views.
 */
const LEGACY_REASON_LABELS: Record<string, string> = {
  loyalty_discount: "Loyalty / repeat customer",
  volume_discount: "Volume discount",
  senior_discount: "Senior discount",
  stairs_not_modelled: "Stairs / long carry not in engine model",
  heavy_items_not_modelled: "Heavy items not fully captured by engine",
  access_difficulty: "Access difficulty engine underestimates",
};

export type PriceOverrideReasonValue =
  (typeof PRICE_OVERRIDE_REASONS)[number]["value"];

/** Resolve a value to its label — check current list, then legacy codes, then pass through. */
export function priceOverrideReasonLabel(value: string): string {
  const match = PRICE_OVERRIDE_REASONS.find((r) => r.value === value);
  if (match) return match.label;
  if (LEGACY_REASON_LABELS[value]) return LEGACY_REASON_LABELS[value];
  return value;
}

/**
 * Map "code or free text" back to the final reason string that gets
 * stored on the quote / shown in audit.
 *
 * If the value matches one of the curated codes, use that code's
 * label. Otherwise the value IS already the free text (operator typed
 * something via the "Other" path) — pass through.
 */
export function buildPriceOverrideReasonText(value: string): string {
  if (!value) return "";
  const isKnownCode = PRICE_OVERRIDE_REASONS.some((r) => r.value === value);
  return isKnownCode ? priceOverrideReasonLabel(value) : value.trim();
}
