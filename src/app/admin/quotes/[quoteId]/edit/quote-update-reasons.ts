/**
 * Curated reasons a coordinator might re-issue a quote.
 *
 * Reason text is shown in the client email and logged in HubSpot, so the
 * options are written client-readable, not internal jargon. Order matters:
 * most-common at the top, "Other" last with a free-text input.
 */
export const QUOTE_UPDATE_REASONS = [
  { value: "price_adjustment_competitive", label: "Pricing adjustment — competitive match" },
  { value: "price_adjustment_loyalty",     label: "Pricing adjustment — loyalty / repeat client" },
  { value: "price_correction",             label: "Pricing correction — original was inaccurate" },
  { value: "inventory_added",              label: "Inventory updated — client added items" },
  { value: "inventory_removed",            label: "Inventory updated — client removed items" },
  { value: "date_changed",                 label: "Move date changed" },
  { value: "address_changed",              label: "Address changed" },
  { value: "access_updated",               label: "Access details updated (parking, floors, elevator)" },
  { value: "size_or_tier_changed",         label: "Move size or service tier changed" },
  { value: "addons_added",                 label: "Add-ons added (packing, storage, etc.)" },
  { value: "addons_removed",               label: "Add-ons removed" },
  { value: "correction",                   label: "Correcting an error in the original quote" },
  { value: "other",                        label: "Other (write your own)" },
] as const;

export type QuoteUpdateReasonValue =
  (typeof QUOTE_UPDATE_REASONS)[number]["value"];

/** Resolve a reason value back to its client-facing label. */
export function reasonLabel(value: string): string {
  const match = QUOTE_UPDATE_REASONS.find((r) => r.value === value);
  return match?.label ?? value;
}

/**
 * Build the final reason string sent to the client / HubSpot.
 *
 * Most values resolve to their preset label. "other" needs the operator-
 * typed text; pass it through verbatim.
 */
export function buildReasonText(
  value: string,
  freeText: string,
): string {
  if (value === "other") return freeText.trim();
  if (!value) return freeText.trim();
  return reasonLabel(value);
}
