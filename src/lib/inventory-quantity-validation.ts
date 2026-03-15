/**
 * Inventory quantity sanity checks for the quoting algorithm.
 * Prevents unrealistic quantities (e.g. 14 king mattresses) from skewing quotes.
 */

export const MAX_QUANTITY_PER_ITEM: Record<string, number> = {
  // Bedroom — max reasonable for largest homes
  king_bed_frame: 4,
  queen_bed_frame: 4,
  double_bed_frame: 4,
  single_twin_bed_frame: 6,
  king_mattress: 4,
  queen_mattress: 4,
  double_mattress: 4,
  single_mattress: 6,
  "bed-king": 4,
  "bed-queen": 4,
  "bed-double": 4,
  "bed-single": 4,
  dresser_large: 6,
  dresser_small: 6,
  dresser: 6,
  nightstand: 10,
  wardrobe_armoire: 4,
  wardrobe: 4,
  // Living room
  sofa_3_seater: 3,
  sofa_2_seater: 3,
  sofa: 3,
  loveseat: 3,
  sectional_sofa: 2,
  sectional: 2,
  armchair_accent: 8,
  accent_chair: 8,
  coffee_table: 3,
  side_end_table: 8,
  "side-table": 8,
  tv_stand: 3,
  bookshelf_large: 4,
  bookshelf_small: 6,
  bookshelf: 6,
  tv_mounted: 6,
  "tv-large": 6,
  "tv-small": 6,
  // Dining
  dining_table_6: 2,
  dining_table_4: 2,
  "dining-table": 2,
  dining_chair: 12,
  // Default for anything not listed
  _default: 10,
};

function normalizeSlug(slug: string): string {
  return (slug || "").toLowerCase().replace(/-/g, "_").trim();
}

export function validateInventoryQuantity(
  itemSlug: string,
  quantity: number,
  itemName?: string,
): { valid: boolean; maxAllowed: number; warning?: string } {
  const normalized = normalizeSlug(itemSlug);
  const max =
    MAX_QUANTITY_PER_ITEM[itemSlug] ??
    MAX_QUANTITY_PER_ITEM[normalized] ??
    MAX_QUANTITY_PER_ITEM[itemSlug?.replace(/-/g, "_")] ??
    MAX_QUANTITY_PER_ITEM["_default"] ??
    10;

  if (quantity > max) {
    return {
      valid: false,
      maxAllowed: max,
      warning: `Maximum ${max} for ${itemName || "this item"}. Please verify.`,
    };
  }
  return { valid: true, maxAllowed: max };
}

/**
 * Validate all inventory items and return warnings for coordinator review.
 * Used by the quote generate API to set inventory_warnings on the quote.
 */
export function validateInventoryQuantities(
  items: { slug?: string; name?: string; quantity: number }[],
): string[] {
  const warnings: string[] = [];
  for (const item of items ?? []) {
    const slug = item.slug || item.name || "";
    const qty = item.quantity ?? 1;
    const { valid, maxAllowed } = validateInventoryQuantity(slug, qty, item.name);
    if (!valid) {
      const label = item.name || slug || "Item";
      warnings.push(`${label}: qty ${qty} exceeds max ${maxAllowed}`);
    }
  }
  return warnings;
}
