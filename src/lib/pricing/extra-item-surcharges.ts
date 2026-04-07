/**
 * Crew walkthrough / inventory change extra-item surcharges (per item, CAD).
 */

export type ExtraItemWeightTier = "light" | "standard" | "heavy" | "very_heavy";

type TierRates = {
  light: number;
  standard: number;
  heavy: number;
  very_heavy: number;
  fragile_premium: number;
};

const EXTRA_ITEM_SURCHARGES: Record<string, TierRates> = {
  box: { light: 3, standard: 5, heavy: 8, very_heavy: 12, fragile_premium: 0 },
  small: { light: 5, standard: 8, heavy: 15, very_heavy: 25, fragile_premium: 5 },
  medium: { light: 10, standard: 15, heavy: 25, very_heavy: 40, fragile_premium: 10 },
  large: { light: 20, standard: 30, heavy: 45, very_heavy: 65, fragile_premium: 15 },
  extra_large: { light: 30, standard: 45, heavy: 65, very_heavy: 100, fragile_premium: 25 },
  specialty: { light: 50, standard: 100, heavy: 200, very_heavy: 350, fragile_premium: 50 },
};

const ITEM_CATEGORY: Record<string, keyof typeof EXTRA_ITEM_SURCHARGES> = {
  "Flooring boxes": "box",
  "Tile boxes": "box",
  "Box (light)": "box",
  "Box (heavy)": "box",
  Lamp: "small",
  "Side table": "small",
  Nightstand: "small",
  "Small box": "small",
  "Bar stool": "small",
  Chair: "medium",
  "Office chair": "medium",
  "Coffee table": "medium",
  "Desk (small)": "medium",
  'TV (32-50")': "medium",
  "Bookshelf (small)": "medium",
  "Filing cabinet": "medium",
  Sofa: "large",
  "Dining table": "large",
  "Bed frame": "large",
  Dresser: "large",
  Wardrobe: "large",
  "Bookshelf (large)": "large",
  'TV (55"+)': "large",
  'TV (55–65")': "large",
  "Desk (large)": "large",
  "China cabinet": "large",
  Refrigerator: "extra_large",
  Washer: "extra_large",
  Dryer: "extra_large",
  "Piano (Upright)": "extra_large",
  "Hot tub": "extra_large",
  "Piano (Grand)": "specialty",
  "Pool table": "specialty",
  "Pool Table": "specialty",
  "Safe (large)": "specialty",
  "Safe / Heavy Box": "specialty",
  Signage: "medium",
  "Rug (rolled)": "medium",
  "Art / frame": "medium",
  "Trim / moulding": "box",
  "Cabinet (upper)": "medium",
  "Cabinet (lower)": "medium",
  "Countertop slab": "large",
  "Furniture piece": "large",
  "Display fixture": "large",
  "Equipment unit": "extra_large",
  Appliance: "extra_large",
};

function normalizeItemKey(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function resolveCategory(itemName: string): keyof typeof EXTRA_ITEM_SURCHARGES {
  const n = normalizeItemKey(itemName);
  if (ITEM_CATEGORY[n]) return ITEM_CATEGORY[n]!;
  const lower = n.toLowerCase();
  for (const [k, v] of Object.entries(ITEM_CATEGORY)) {
    if (k.toLowerCase() === lower) return v;
  }
  if (/\bbox(es)?\b/i.test(lower) || /flooring|tile|trim|moulding/i.test(lower)) return "box";
  if (/piano|grand/i.test(lower) && /grand/i.test(lower)) return "specialty";
  if (/piano/i.test(lower)) return "extra_large";
  if (/pool/i.test(lower) && /table/i.test(lower)) return "specialty";
  if (/safe|vault/i.test(lower)) return "specialty";
  if (/fridge|refrigerator|washer|dryer|appliance/i.test(lower)) return "extra_large";
  if (/sofa|couch|sectional|wardrobe|china|dining table|desk \(large\)/i.test(lower)) return "large";
  return "medium";
}

export function weightTierFromLegacyScore(ws: number): ExtraItemWeightTier {
  if (ws <= 0.5) return "light";
  if (ws <= 1.0) return "standard";
  if (ws <= 2.0) return "heavy";
  return "very_heavy";
}

/** Heuristic fragile flag when the DB row does not carry it (matches TVs, glass, art, pianos). */
export function fragileItemNameHint(itemName: string): boolean {
  const s = itemName.toLowerCase();
  if (/\b(tv|television|monitor|screen|glass|mirror|marble|artwork|frame|china|vase|ceramic|piano|chandelier)\b/i.test(s)) {
    return true;
  }
  if (/\bart\b/i.test(s) && /\b(painting|frame|work|piece)\b/i.test(s)) return true;
  return false;
}

export function calculateExtraItemPrice(
  itemName: string,
  weight: ExtraItemWeightTier,
  quantity: number,
  fragile: boolean,
): number {
  const category = resolveCategory(itemName);
  const rates = EXTRA_ITEM_SURCHARGES[category] ?? EXTRA_ITEM_SURCHARGES.medium;
  const q = Math.max(1, Math.floor(quantity) || 1);
  let per = rates[weight] ?? rates.standard;
  if (fragile) per += rates.fragile_premium;
  return per * q;
}
