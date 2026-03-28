import {
  parseQuantityFromLine,
  matchPastedLineToItem,
  type ItemWeightLike,
} from "@/lib/inventory-search";

export type ParsedInventoryItem = {
  raw_text: string;
  matched_item: string | null;
  matched_name: string | null;
  quantity: number;
  weight_score: number | null;
  confidence: "high" | "medium" | "low";
  needs_review: boolean;
  note?: string;
};

export type ParsedInventory = {
  items: ParsedInventoryItem[];
  boxCount: number;
  confidence: "high" | "medium" | "low" | "none";
  totalItems: number;
};

function estimateBoxCount(segment: string): number {
  const range = segment.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1]!, 10) + parseInt(range[2]!, 10)) / 2);
  const approx = segment.match(/(?:about|approximately|around|~)\s*(\d+)/i);
  if (approx) return parseInt(approx[1]!, 10);
  if (/several|a few|some/i.test(segment)) return 10;
  if (/lots|many|a lot/i.test(segment)) return 20;
  const num = segment.match(/(\d+)/);
  if (num) return parseInt(num[1]!, 10);
  return 10;
}

function parseQtyWithSeveral(text: string): { name: string; qty: number } {
  const t = text.trim();
  if (/several|a few|some|multiple/i.test(t)) {
    const name = t.replace(/several|a few|some|multiple/gi, "").trim();
    return { name: name || t, qty: 4 };
  }
  if (/^(a |an |one )/i.test(t)) {
    return { name: t.replace(/^(a |an |one )/i, "").trim(), qty: 1 };
  }
  return parseQuantityFromLine(t);
}

export function autoParseInventory<T extends ItemWeightLike>(
  text: string | null | undefined,
  itemWeights: T[],
): ParsedInventory {
  if (!text || !text.trim()) {
    return { items: [], boxCount: 0, confidence: "none", totalItems: 0 };
  }

  let normalized = text
    .toLowerCase()
    .replace(/\//g, ", ")
    .replace(/\band\b/g, ",")
    .replace(/\+/g, ",")
    .replace(/\n/g, ", ");

  const segments = normalized
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedItems: ParsedInventoryItem[] = [];
  let boxCount = 0;
  let overall: "high" | "medium" | "low" = "high";

  for (const segment of segments) {
    if (segment.length < 2) continue;

    const { name: itemName, qty } = parseQtyWithSeveral(segment);

    if (/box|boxes|carton|bin|container/i.test(itemName)) {
      boxCount += qty > 0 ? qty : estimateBoxCount(segment);
      continue;
    }

    if (/everything|all of|entire|whole|misc|various|stuff|things/i.test(itemName)) {
      overall = overall === "high" ? "low" : overall;
      parsedItems.push({
        raw_text: segment,
        matched_item: null,
        matched_name: null,
        quantity: qty || 1,
        weight_score: null,
        confidence: "low",
        needs_review: true,
        note: "Vague description — coordinator review",
      });
      continue;
    }

    const { item, confidence } = matchPastedLineToItem(itemName, itemWeights);
    const mc: "high" | "medium" | "low" =
      confidence === "high" ? "high" : confidence === "medium" ? "medium" : "low";

    if (item && (confidence === "high" || confidence === "medium")) {
      if (confidence === "medium" && overall === "high") overall = "medium";
      parsedItems.push({
        raw_text: segment,
        matched_item: item.slug,
        matched_name: item.item_name,
        quantity: qty || 1,
        weight_score: item.weight_score ?? null,
        confidence: mc,
        needs_review: confidence !== "high",
      });
    } else {
      overall = overall === "high" ? "medium" : overall;
      parsedItems.push({
        raw_text: segment,
        matched_item: null,
        matched_name: null,
        quantity: qty || 1,
        weight_score: null,
        confidence: "low",
        needs_review: true,
        note: "No confident catalog match — coordinator review",
      });
    }
  }

  const totalItems = parsedItems.reduce((s, i) => s + i.quantity, 0);

  return {
    items: parsedItems,
    boxCount,
    confidence: parsedItems.length === 0 ? "none" : overall,
    totalItems,
  };
}
