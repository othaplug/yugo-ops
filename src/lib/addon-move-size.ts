/**
 * Shared utilities for move-size-based tiered add-on pricing.
 * Used by both the client quote page and the admin Generate Quote form.
 *
 * For these addons, the tier is auto-resolved from the quote's move_size —
 * no user dropdown is shown. The tier arrays in the DB are ordered by move size.
 */

/**
 * Addons whose tiers are ordered by move size.
 * Value: move_size key → tier array index.
 */
export const MOVE_SIZE_TIERED_ADDONS: Record<string, Record<string, number>> = {
  // 6-tier: Studio(0) 1BR(1) 2BR(2) 3BR(3) 4BR(4) 5BR+(5)
  packing_materials: {
    studio: 0, "1br": 1, "2br": 2, "3br": 3, "4br": 4, "5br_plus": 5, partial: 0,
  },
  // 4-tier: Studio/1BR(0) 2BR(1) 3BR(2) 4BR+(3)
  full_packing: {
    studio: 0, "1br": 0, "2br": 1, "3br": 2, "4br": 3, "5br_plus": 3, partial: 0,
  },
  unpacking: {
    studio: 0, "1br": 0, "2br": 1, "3br": 2, "4br": 3, "5br_plus": 3, partial: 0,
  },
};

/**
 * Returns the tier array index for a move-size-tiered addon,
 * or null if the addon is not move-size-tiered (i.e. keep user dropdown).
 */
export function getMoveSizeTierIndex(slug: string, moveSize: string | null | undefined): number | null {
  const map = MOVE_SIZE_TIERED_ADDONS[slug];
  if (!map || !moveSize) return null;
  return map[moveSize] ?? 0;
}

/**
 * Packing kit box contents, keyed by tier index (0–5).
 * Matches the MOVE_SIZE_TIERED_ADDONS.packing_materials index order.
 */
export const PACKING_KIT_CONTENTS: Record<number, string> = {
  0: "5 small, 5 medium, 5 large boxes · 2 wardrobe boxes (rental) · 4 tape rolls · 12.5 lbs packing paper",
  1: "8 small, 15 medium, 7 large boxes · 3 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  2: "15 small, 25 medium, 10 large boxes · 4 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  3: "25 small, 40 medium, 15 large boxes · 6 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  4: "35 small, 55 medium, 20 large boxes · 8 wardrobe boxes (rental) · 8 tape rolls · 25 lbs packing paper",
  5: "45 small, 70 medium, 25 large boxes · 10 wardrobe boxes (rental) · 10 tape rolls · 25 lbs packing paper",
};
