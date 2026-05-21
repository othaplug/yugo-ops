/**
 * Context-aware copy for the Single Item quote surfaces.
 *
 * The same service_type ("single_item") is used for two genuinely different
 * customer jobs:
 *
 *   1. Commercial delivery — vendor-to-business, dock-to-dock, one item,
 *      no assembly. "Your Delivery Quote / CONFIRM DELIVERY / Disposal Included"
 *      is the right tone.
 *
 *   2. Small residential move — client moving a sofa from old apartment to
 *      new apartment, may include stair carry, may include assembly. The
 *      commercial delivery copy is jarring for these clients ("delivery"
 *      sounds like a parcel, not a move of their own furniture).
 *
 * This helper picks the right copy bundle based on signals already in the
 * quote. It does NOT need a new column or coordinator override — every
 * signal it uses (item categories, assembly, stair carry, access types,
 * walkthrough/booking notes) is already captured during quote creation.
 *
 * Detection order (first hit wins):
 *   1. loading_dock on either side → COMMERCIAL
 *   2. residential access on either side (walk_up_*, basement*, elevator,
 *      concierge, ground_floor) → RESIDENTIAL
 *   3. any item line has stair_carry, assembly != none, or category in
 *      (large_heavy, standard_furniture, oversized) → RESIDENTIAL
 *   4. walkthrough_notes / booking_notes contain "home" | "apartment" |
 *      "condo" | "house" → RESIDENTIAL
 *   5. otherwise → COMMERCIAL (default for the service type)
 */

import {
  resolveSingleItemLines,
  type LegacyScalarQuote,
  type SingleItemLine,
} from "./single-item-types";

export type SingleItemCopyMode = "residential" | "commercial";

export type SingleItemCopy = {
  mode: SingleItemCopyMode;
  /** Big hero heading. */
  pageTitle: string;
  /** Subtitle under the hero. */
  pageSubtitle: string;
  /** Email subject prefix when the quote is first sent. */
  emailSubject: string;
  /** "WHAT'S INCLUDED" vs "DELIVERY INCLUSIONS" / "YOUR DELIVERY INCLUDES". */
  includesSectionLabel: string;
  /** Fallback item label when an individual line has no description. */
  itemFallbackLabel: string;
  /** CTA button label. Receives the formatted price string. */
  confirmButtonLabel: (priceLabel: string) => string;
  /** Payment-timing note shown under the CTA. */
  paymentNote: (isFullPayment: boolean) => string;
};

const RESIDENTIAL_COPY: Omit<SingleItemCopy, "mode"> = {
  pageTitle: "Your Move Quote",
  pageSubtitle:
    "Professional handling and care for every item. Reviewed, scoped, and ready to book.",
  emailSubject: "Your Move Quote",
  includesSectionLabel: "What's Included",
  itemFallbackLabel: "Item Move",
  confirmButtonLabel: (priceLabel) => `CONFIRM BOOKING · ${priceLabel}`,
  paymentNote: (isFullPayment) =>
    isFullPayment
      ? "Full payment is due no later than 48 hours before your scheduled move day."
      : "Deposit due now. Remaining balance is due no later than 48 hours before your scheduled move day.",
};

const COMMERCIAL_COPY: Omit<SingleItemCopy, "mode"> = {
  pageTitle: "Your Delivery Quote",
  pageSubtitle:
    "Safe, professional transport for your item with full protection and care.",
  emailSubject: "Your Delivery Quote",
  includesSectionLabel: "Your Delivery Includes",
  itemFallbackLabel: "Single Item Delivery",
  confirmButtonLabel: (priceLabel) => `CONFIRM DELIVERY · ${priceLabel}`,
  paymentNote: (isFullPayment) =>
    isFullPayment
      ? "Full payment is due no later than 48 hours before your scheduled delivery."
      : "Deposit due now. Remaining balance is due no later than 48 hours before your scheduled delivery.",
};

const RESIDENTIAL_ACCESS = new Set([
  "elevator",
  "concierge",
  "ground_floor",
  "basement",
  "basement_stairs",
  "basement_walkout",
  "walk_up_2nd",
  "walk_up_3rd",
  "walk_up_4th_plus",
  "walk_up_4plus",
  "walk_up_4_plus",
  "walk_up_2",
  "walk_up_3",
  "walk_up_4th",
  "narrow_stairs",
]);
const COMMERCIAL_ACCESS = new Set(["loading_dock"]);
const RESIDENTIAL_CATEGORY = new Set([
  "large_heavy",
  "standard_furniture",
  "oversized",
]);
const NOTE_KEYWORDS = ["home", "apartment", "condo", "house"];

export type SingleItemDetectionInput = {
  from_access?: string | null;
  to_access?: string | null;
  walkthrough_notes?: string | null;
  booking_notes?: string | null;
  /** When set, takes precedence over scalar fallback. */
  quote_items?: unknown;
  /** Scalar fallback fields (used by resolveSingleItemLines). */
  scalars: LegacyScalarQuote;
};

export function detectSingleItemMode(
  input: SingleItemDetectionInput,
): SingleItemCopyMode {
  const fromA = (input.from_access ?? "").toLowerCase().trim();
  const toA = (input.to_access ?? "").toLowerCase().trim();

  // 1) Commercial access wins.
  if (COMMERCIAL_ACCESS.has(fromA) || COMMERCIAL_ACCESS.has(toA)) {
    return "commercial";
  }
  // 2) Residential access wins.
  if (RESIDENTIAL_ACCESS.has(fromA) || RESIDENTIAL_ACCESS.has(toA)) {
    return "residential";
  }

  // 3) Per-line signals.
  const lines: SingleItemLine[] = resolveSingleItemLines(
    input.quote_items,
    input.scalars,
  );
  const hasResidentialLine = lines.some((l) => {
    if (l.stair_carry) return true;
    const asm = (l.assembly || "").toLowerCase();
    if (asm.includes("both") || asm.includes("assembly") || asm.includes("disassembly")) {
      return true;
    }
    return RESIDENTIAL_CATEGORY.has((l.item_category || "").toLowerCase());
  });
  if (hasResidentialLine) return "residential";

  // 4) Free-text notes.
  const notes = (
    (input.walkthrough_notes ?? "") +
    " " +
    (input.booking_notes ?? "")
  ).toLowerCase();
  if (NOTE_KEYWORDS.some((k) => notes.includes(k))) return "residential";

  // 5) Default.
  return "commercial";
}

export function getSingleItemQuoteCopy(
  input: SingleItemDetectionInput,
): SingleItemCopy {
  const mode = detectSingleItemMode(input);
  const base = mode === "residential" ? RESIDENTIAL_COPY : COMMERCIAL_COPY;
  return { mode, ...base };
}
