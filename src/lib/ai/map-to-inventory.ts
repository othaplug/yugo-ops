import type { AIInventorySuggestion } from "@/lib/ai/photo-inventory";
import type { InventoryItemEntry } from "@/components/inventory/InventoryInput";
import { nameImpliesFragile } from "@/lib/inventory-search";
import { WEIGHT_TO_TIER } from "@/lib/ai/photo-inventory";

type WeightRow = {
  slug: string
  item_name: string
  weight_score: number
  room?: string | null
};

const KEYWORD_TO_NAME: { keys: string[]; yugoName: string; defaultScore: number }[] = [
  { keys: ["sectional"], yugoName: "Sectional Sofa", defaultScore: 7 },
  { keys: ["sofa", "couch"], yugoName: "Sofa / Couch", defaultScore: 5 },
  { keys: ["coffee table"], yugoName: "Coffee Table", defaultScore: 2 },
  { keys: ["tv stand", "entertainment center"], yugoName: "TV Stand", defaultScore: 2.5 },
  { keys: ["bookshelf", "bookcase"], yugoName: "Bookshelf", defaultScore: 3 },
  { keys: ["armchair", "accent chair"], yugoName: "Armchair", defaultScore: 2.5 },
  { keys: ["king bed"], yugoName: "King Bed Frame", defaultScore: 6 },
  { keys: ["queen bed"], yugoName: "Queen Bed Frame", defaultScore: 5 },
  { keys: ["twin bed"], yugoName: "Twin / Single Bed", defaultScore: 3 },
  { keys: ["dresser", "chest of drawers"], yugoName: "Dresser", defaultScore: 3.5 },
  { keys: ["nightstand", "bedside"], yugoName: "Nightstand", defaultScore: 1 },
  { keys: ["wardrobe", "armoire"], yugoName: "Wardrobe / Armoire", defaultScore: 5 },
  { keys: ["dining table"], yugoName: "Dining Table", defaultScore: 4 },
  { keys: ["dining chair"], yugoName: "Dining Chairs", defaultScore: 0.5 },
  { keys: ["refrigerator", "fridge"], yugoName: "Refrigerator", defaultScore: 5 },
  { keys: ["washer"], yugoName: "Washer", defaultScore: 4 },
  { keys: ["dryer"], yugoName: "Dryer", defaultScore: 4 },
  { keys: ["desk"], yugoName: "Desk", defaultScore: 2.5 },
  { keys: ["piano"], yugoName: "Piano (upright/baby grand)", defaultScore: 8 },
  { keys: ["treadmill"], yugoName: "Treadmill", defaultScore: 5 },
];

function findCatalogMatch(
  lower: string,
  itemWeights: WeightRow[],
): { row: WeightRow; matchedLabel: string } | null {
  for (const def of KEYWORD_TO_NAME) {
    for (const k of def.keys) {
      if (!lower.includes(k)) continue;
      const row =
        itemWeights.find(
          (w) => w.item_name === def.yugoName || w.item_name.toLowerCase() === def.yugoName.toLowerCase(),
        ) || itemWeights.find((w) => w.item_name.toLowerCase().includes(k));
      if (row) {
        return { row, matchedLabel: def.yugoName };
      }
    }
  }
  const row = itemWeights.find(
    (w) =>
      w.item_name.length > 2 && lower.includes(w.item_name.toLowerCase().slice(0, 8)),
  );
  if (row) {
    return { row, matchedLabel: row.item_name };
  }
  return null;
}

/**
 * Map Claude suggestions into residential inventory lines for coordinator review.
 */
export function mapAISuggestionsToInventory(
  suggestions: AIInventorySuggestion[],
  itemWeights: WeightRow[],
): InventoryItemEntry[] {
  return suggestions.map((suggestion) => {
    const lowerName = suggestion.name.toLowerCase();
    const match = findCatalogMatch(lowerName, itemWeights);
    const tierCode =
      (WEIGHT_TO_TIER[suggestion.weight] as InventoryItemEntry["weight_tier_code"]) ||
      "standard";
    const baseFragile = suggestion.fragile || nameImpliesFragile(suggestion.name);

    if (match) {
      const ws = Number(match.row.weight_score);
      return {
        slug: match.row.slug,
        name: match.row.item_name,
        quantity: Math.max(1, suggestion.quantity || 1),
        weight_score: ws,
        weight_tier_code: tierCode,
        fragile: baseFragile,
        room: suggestion.room,
        isCustom: false,
      };
    }

    return {
      name: suggestion.name,
      quantity: Math.max(1, suggestion.quantity || 1),
      weight_score: 2,
      weight_tier_code: tierCode,
      fragile: baseFragile,
      room: suggestion.room,
      isCustom: true,
    };
  });
}
