/**
 * B2B line weight: map pounds / item_weight scores to dimensional tiers,
 * aligned with Prompt 4 vertical tables (coordinator can always override).
 */

export type B2bLineWeightTier = "light" | "medium" | "heavy" | "extra_heavy";

/** Map inventory weight_score (1–5 scale) to B2B line tier. */
export function itemWeightScoreToB2bCategory(score: number): B2bLineWeightTier {
  if (!Number.isFinite(score) || score <= 1.25) return "light";
  if (score <= 2.5) return "medium";
  if (score <= 4) return "heavy";
  return "extra_heavy";
}

/**
 * Infer tier from explicit pounds when coordinator did not pick a tier.
 * Thresholds vary by vertical family.
 */
export function inferB2bWeightCategoryFromLbs(lbs: number, verticalCode: string): B2bLineWeightTier {
  const v = verticalCode.toLowerCase();
  if (!Number.isFinite(lbs) || lbs <= 0) return "light";

  if (v === "medical_equipment") {
    if (lbs < 200) return "light";
    if (lbs < 500) return "medium";
    return "heavy";
  }
  if (v === "appliance") {
    if (lbs < 150) return "light";
    if (lbs < 300) return "medium";
    return "heavy";
  }
  if (v === "ecommerce_bulk") {
    if (lbs < 50) return "light";
    if (lbs < 100) return "medium";
    return "heavy";
  }
  if (v === "restaurant_hospitality") {
    if (lbs < 100) return "light";
    if (lbs < 300) return "medium";
    return "heavy";
  }
  // furniture_retail, designer, art_gallery, flooring boxes, default
  if (lbs < 100) return "light";
  if (lbs < 200) return "medium";
  if (lbs < 400) return "heavy";
  return "extra_heavy";
}

/** Inventory row shape from admin item_weights (slug optional in some payloads). */
export type B2bInventoryWeightHint = {
  item_name: string;
  slug?: string;
  weight_score: number;
};

/**
 * Match line description to catalog item names (longest match first) for tier suggestion.
 * Coordinator can always change the dropdown after.
 */
export function suggestB2bWeightTierFromDescription(
  description: string,
  weights: B2bInventoryWeightHint[],
): B2bLineWeightTier | null {
  const d = description.trim().toLowerCase();
  if (!d || weights.length === 0) return null;
  const sorted = [...weights].sort((a, b) => b.item_name.length - a.item_name.length);
  for (const w of sorted) {
    const name = w.item_name.trim().toLowerCase();
    if (name && d.includes(name)) return itemWeightScoreToB2bCategory(w.weight_score);
    if (w.slug) {
      const slug = w.slug.replace(/_/g, " ").toLowerCase();
      if (slug && d.includes(slug)) return itemWeightScoreToB2bCategory(w.weight_score);
    }
  }
  return null;
}
