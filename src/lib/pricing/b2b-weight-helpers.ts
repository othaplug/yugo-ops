/**
 * B2B line weight: map pounds / item_weight scores to dimensional tiers,
 * aligned with shared WEIGHT_TIERS (coordinator can always override).
 */

import {
  type WeightTierCode,
  inferWeightTierFromLegacyScore,
  normalizeB2bWeightCategory,
} from "./weight-tiers";

export type B2bLineWeightTier = WeightTierCode;

/** Map inventory weight_score (1–5 or fractional scale) to B2B line tier. */
export function itemWeightScoreToB2bCategory(score: number): B2bLineWeightTier {
  if (!Number.isFinite(score)) return "standard";
  if (score > 0 && score <= 5 && score === Math.round(score)) {
    if (score <= 1) return "light";
    if (score === 2) return "standard";
    if (score === 3) return "heavy";
    if (score === 4) return "very_heavy";
    return "super_heavy";
  }
  return inferWeightTierFromLegacyScore(score);
}

/**
 * Infer tier from explicit pounds when coordinator did not pick a tier.
 */
export function inferB2bWeightCategoryFromLbs(
  lbs: number,
  _verticalCode: string,
): B2bLineWeightTier {
  if (!Number.isFinite(lbs) || lbs <= 0) return "light";
  if (lbs < 50) return "light";
  if (lbs < 150) return "standard";
  if (lbs < 300) return "heavy";
  if (lbs < 500) return "very_heavy";
  if (lbs < 800) return "super_heavy";
  return "extreme";
}

/** Inventory row shape from admin item_weights (slug optional in some payloads). */
export type B2bInventoryWeightHint = {
  item_name: string;
  slug?: string;
  weight_score: number;
};

/**
 * Match line description to catalog item names (longest match first) for tier suggestion.
 */
export function suggestB2bWeightTierFromDescription(
  description: string,
  weights: B2bInventoryWeightHint[],
): B2bLineWeightTier | null {
  const d = description.trim().toLowerCase();
  if (!d || weights.length === 0) return null;
  const sorted = [...weights].sort(
    (a, b) => b.item_name.length - a.item_name.length,
  );
  for (const w of sorted) {
    const name = w.item_name.trim().toLowerCase();
    if (name && d.includes(name))
      return itemWeightScoreToB2bCategory(w.weight_score);
    if (w.slug) {
      const slug = w.slug.replace(/_/g, " ").toLowerCase();
      if (slug && d.includes(slug))
        return itemWeightScoreToB2bCategory(w.weight_score);
    }
  }
  return null;
}

export { normalizeB2bWeightCategory };
