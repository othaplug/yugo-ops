/**
 * Client + server: infer move size from inventory (secondary to explicit coordinator choice).
 */

export interface SuggestionInventoryItem {
  name?: string;
  quantity?: number;
}

function qty(i: SuggestionInventoryItem): number {
  const q = i.quantity;
  return typeof q === "number" && q > 0 ? q : 1;
}

export type MoveSizeSuggestion = {
  suggested: string;
  confidence: "high" | "medium";
  reason: string;
};

const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  partial: "Partial move",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
};

export function moveSizeLabel(size: string): string {
  return MOVE_SIZE_LABELS[size] ?? size;
}

/**
 * Weighted inventory score (same formula as QuoteFormClient inventoryScore + boxes × 0.3).
 */
export function weightedInventoryScore(
  items: { quantity: number; weight_score: number }[],
  boxCount: number,
): number {
  let itemScore = 0;
  for (const i of items) {
    const q = i.quantity > 0 ? i.quantity : 1;
    itemScore += (i.weight_score || 1) * q;
  }
  return itemScore + boxCount * 0.3;
}

export function suggestMoveSizeFromInventory(
  items: SuggestionInventoryItem[],
  boxCount: number,
  itemScore: number,
): MoveSizeSuggestion {
  const score = itemScore + boxCount * 0.3;

  const beds = items
    .filter((i) => /bed frame|bunk bed/i.test((i.name || "").toLowerCase()))
    .reduce((sum, i) => sum + qty(i), 0);

  const cribs = items
    .filter((i) => /crib|bassinet|toddler bed/i.test((i.name || "").toLowerCase()))
    .reduce((sum, i) => sum + qty(i), 0);

  const dressers = items
    .filter((i) => /dresser|wardrobe|armoire|chest of drawers/i.test((i.name || "").toLowerCase()))
    .reduce((sum, i) => sum + qty(i), 0);

  const nightstands = items
    .filter((i) => /nightstand|night table|bedside/i.test((i.name || "").toLowerCase()))
    .reduce((sum, i) => sum + qty(i), 0);

  const supportFurniture = dressers + Math.floor(nightstands / 2);
  const fullBedrooms = Math.min(beds, supportFurniture);
  const extraBeds = beds - fullBedrooms;
  const halfBedrooms = extraBeds * 0.5 + cribs * 0.5;
  const estimatedBedrooms = fullBedrooms + halfBedrooms;

  let suggested: string;
  let reason: string;

  if (estimatedBedrooms < 0.5 && score < 15) {
    suggested = "studio";
    reason = "No beds detected. Score under 15.";
  } else if (estimatedBedrooms < 0.5 && score >= 15) {
    suggested = "partial";
    reason = "No beds but substantial inventory. Likely partial or non-bedroom move.";
  } else if (estimatedBedrooms <= 1 && score < 35) {
    suggested = "1br";
    reason = `${beds} bed(s), score ${score.toFixed(1)}. Consistent with 1 bedroom.`;
  } else if (estimatedBedrooms <= 1 && score >= 35) {
    suggested = "1br";
    reason = `${beds} bed(s) but score ${score.toFixed(1)} is high for 1 BR. Confirm second bedroom if needed.`;
  } else if (estimatedBedrooms <= 2 && score < 55) {
    suggested = "2br";
    reason = `${beds} bed(s), ${dressers} dresser(s), score ${score.toFixed(1)}.`;
  } else if (estimatedBedrooms <= 3 && score < 80) {
    suggested = "3br";
    reason = `${beds} bed(s), score ${score.toFixed(1)}.`;
  } else if (estimatedBedrooms <= 4) {
    suggested = "4br";
    reason = `${beds} bed(s), score ${score.toFixed(1)}.`;
  } else {
    suggested = "5br_plus";
    reason = `${beds} bed(s), score ${score.toFixed(1)}.`;
  }

  const confidence: "high" | "medium" = fullBedrooms > 0 ? "high" : "medium";

  return { suggested, confidence, reason };
}

/** Typical score band for a move size (for coordinator warnings). */
export function expectedScoreRangeForMoveSize(moveSize: string): { min: number; max: number } | null {
  const ranges: Record<string, { min: number; max: number }> = {
    studio: { min: 0, max: 15 },
    partial: { min: 6, max: 20 },
    "1br": { min: 15, max: 35 },
    "2br": { min: 35, max: 55 },
    "3br": { min: 55, max: 80 },
    "4br": { min: 80, max: 110 },
    "5br_plus": { min: 110, max: 999 },
  };
  return ranges[moveSize] ?? null;
}

export function moveSizeInventoryMismatchMessage(
  moveSize: string,
  score: number,
  suggestedSize: string,
): string | null {
  const range = expectedScoreRangeForMoveSize(moveSize);
  if (!range || !moveSize) return null;
  if (score >= range.min && score <= range.max) return null;
  const sugLabel = moveSizeLabel(suggestedSize);
  if (score < range.min) {
    return `Inventory score (${score.toFixed(1)}) is below the typical range for ${moveSizeLabel(moveSize)} (about ${range.min}–${range.max}). This may produce a higher quote than the volume suggests. Auto-detected: ${sugLabel}.`;
  }
  return `Inventory score (${score.toFixed(1)}) is above the typical range for ${moveSizeLabel(moveSize)} (about ${range.min}–${range.max}). Confirm move size or adjust inventory. Auto-detected: ${sugLabel}.`;
}
