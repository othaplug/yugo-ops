import type { AIInventorySuggestion } from "@/lib/ai/photo-inventory";
import type { InventoryItemEntry } from "@/components/inventory/InventoryInput";
import { matchPastedLineToItem, nameImpliesFragile } from "@/lib/inventory-search";
import { WEIGHT_TO_TIER } from "@/lib/ai/photo-inventory";
import { inferWeightTierFromLegacyScore } from "@/lib/pricing/weight-tiers";

type WeightRow = {
  slug: string;
  item_name: string;
  weight_score: number;
  room?: string | null;
  active?: boolean;
};

/**
 * Map Claude suggestions into residential inventory lines for coordinator review.
 * Uses the same paste classification guards as quotes/moves (`matchPastedLineToItem`).
 */
export function mapAISuggestionsToInventory(
  suggestions: AIInventorySuggestion[],
  itemWeights: WeightRow[],
): InventoryItemEntry[] {
  return suggestions.map((suggestion) => {
    const tierCode =
      (WEIGHT_TO_TIER[suggestion.weight] as InventoryItemEntry["weight_tier_code"]) ||
      "standard";
    const baseFragile =
      suggestion.fragile || nameImpliesFragile(suggestion.name);

    const pasteMatch = matchPastedLineToItem(suggestion.name, itemWeights);
    if (
      pasteMatch.item &&
      (pasteMatch.confidence === "high" || pasteMatch.confidence === "medium")
    ) {
      const row = pasteMatch.item;
      const ws = Number(row.weight_score);
      return {
        slug: row.slug,
        name: row.item_name,
        quantity: Math.max(1, suggestion.quantity || 1),
        weight_score: ws,
        weight_tier_code: inferWeightTierFromLegacyScore(ws),
        fragile: baseFragile,
        room: suggestion.room ?? row.room ?? undefined,
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
