/**
 * Curated reasons a coordinator might override a quote's engine-computed
 * price (either per-tier or the global pre-tax total).
 *
 * Different intent from `quote-update-reasons.ts` — that one explains
 * WHY the operator is re-issuing the quote to the client. This one
 * explains WHY the price was hand-set. Both are logged and surface
 * in audit trails; they live in distinct dropdowns on the edit page.
 */
export const PRICE_OVERRIDE_REASONS = [
  { value: "competitive_match",       label: "Competitive match" },
  { value: "loyalty_discount",        label: "Loyalty / repeat client" },
  { value: "volume_discount",         label: "Volume discount" },
  { value: "senior_discount",         label: "Senior discount" },
  { value: "corporate_rate",          label: "Corporate / partner rate" },
  { value: "realtor_referral",        label: "Realtor referral courtesy" },
  { value: "stairs_not_modelled",     label: "Stairs / long carry not in engine model" },
  { value: "heavy_items_not_modelled",label: "Heavy items not fully captured by engine" },
  { value: "access_difficulty",       label: "Access difficulty engine underestimates" },
  { value: "manual_correction",       label: "Manual correction (engine misread)" },
  { value: "insurance_inclusion",     label: "Additional insurance coverage included" },
  { value: "goodwill_adjustment",     label: "Goodwill adjustment" },
  { value: "other",                   label: "Other (write your own)" },
] as const;

export type PriceOverrideReasonValue =
  (typeof PRICE_OVERRIDE_REASONS)[number]["value"];

/** Resolve a value to its label, or fall through unchanged. */
export function priceOverrideReasonLabel(value: string): string {
  const match = PRICE_OVERRIDE_REASONS.find((r) => r.value === value);
  return match?.label ?? value;
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
