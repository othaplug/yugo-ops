/**
 * Packing materials kit, per-tier contents + prices. Single source of truth.
 *
 * These used to be hardcoded only inside the quote page component (and nowhere
 * else), so the admin, confirmation email and PDF never showed what the client
 * was promised, and the quantities couldn't be reused. This centralizes the
 * canonical list so every surface renders the same thing.
 *
 * Economics (approved 2026-10-04): priced for a healthy TRUE landed margin
 * (materials + ~$8 bundled delivery on an existing route + card fees), blending
 * ~45% on the small tiers for competitiveness up to ~55% on the large tiers.
 * The addon catalog's `packing_materials` tier prices are kept in sync with the
 * `price` values below.
 */

export type PackingKitTier = {
  /** Canonical move-size key. */
  key: string;
  /** Client-facing label. */
  label: string;
  /** Pre-tax price for this tier. Mirrors addons.tiers[].price. */
  price: number;
  smallBoxes: number;
  mediumBoxes: number;
  largeBoxes: number;
  wardrobeBoxes: number;
  tapeRolls: number;
  packingPaperLbs: number;
};

/** Ordered by tier index (0 = studio). Index matches addons.tiers order. */
export const PACKING_KIT_TIERS: PackingKitTier[] = [
  { key: "studio", label: "Studio", price: 150, smallBoxes: 6, mediumBoxes: 6, largeBoxes: 4, wardrobeBoxes: 1, tapeRolls: 3, packingPaperLbs: 10 },
  { key: "1br", label: "1 Bedroom", price: 210, smallBoxes: 8, mediumBoxes: 12, largeBoxes: 6, wardrobeBoxes: 2, tapeRolls: 4, packingPaperLbs: 10 },
  { key: "2br", label: "2 Bedroom", price: 300, smallBoxes: 12, mediumBoxes: 18, largeBoxes: 8, wardrobeBoxes: 3, tapeRolls: 5, packingPaperLbs: 12.5 },
  { key: "3br", label: "3 Bedroom", price: 480, smallBoxes: 18, mediumBoxes: 28, largeBoxes: 12, wardrobeBoxes: 4, tapeRolls: 6, packingPaperLbs: 15 },
  { key: "4br", label: "4 Bedroom", price: 700, smallBoxes: 25, mediumBoxes: 38, largeBoxes: 15, wardrobeBoxes: 6, tapeRolls: 8, packingPaperLbs: 20 },
  { key: "5br_plus", label: "5+ Bedroom", price: 920, smallBoxes: 32, mediumBoxes: 48, largeBoxes: 20, wardrobeBoxes: 8, tapeRolls: 10, packingPaperLbs: 25 },
];

/** Move-size string -> tier index. Mirrors the quote engine's move_size values. */
export const PACKING_KIT_TIER_INDEX_BY_SIZE: Record<string, number> = {
  studio: 0,
  "1br": 1,
  "2br": 2,
  "3br": 3,
  "4br": 4,
  "5br_plus": 5,
  partial: 0,
};

export function packingKitTierByIndex(idx: number | null | undefined): PackingKitTier {
  const i = typeof idx === "number" && idx >= 0 && idx < PACKING_KIT_TIERS.length ? idx : 0;
  return PACKING_KIT_TIERS[i];
}

export function packingKitTierForSize(size?: string | null): PackingKitTier {
  const idx = PACKING_KIT_TIER_INDEX_BY_SIZE[String(size ?? "").toLowerCase()] ?? 0;
  return packingKitTierByIndex(idx);
}

/** The one-line contents string, e.g.
 *  "6 small, 6 medium, 4 large boxes · 1 wardrobe box (rental) · 3 tape rolls · 10 lbs packing paper". */
export function formatPackingKitContents(tier: PackingKitTier): string {
  const wb = tier.wardrobeBoxes === 1 ? "box" : "boxes";
  const tr = tier.tapeRolls === 1 ? "roll" : "rolls";
  return (
    `${tier.smallBoxes} small, ${tier.mediumBoxes} medium, ${tier.largeBoxes} large boxes` +
    ` · ${tier.wardrobeBoxes} wardrobe ${wb} (rental)` +
    ` · ${tier.tapeRolls} tape ${tr}` +
    ` · ${tier.packingPaperLbs} lbs packing paper`
  );
}

export function packingKitContentsByIndex(idx: number | null | undefined): string {
  return formatPackingKitContents(packingKitTierByIndex(idx));
}

export function packingKitContentsForSize(size?: string | null): string {
  return formatPackingKitContents(packingKitTierForSize(size));
}
