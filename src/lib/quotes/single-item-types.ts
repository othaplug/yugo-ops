/**
 * Shared types for the Single Item quote flow.
 *
 * Background: the form was a single (item_description + category + weight +
 * assembly + stair_carry) scalar row plus a "number of items" multiplier.
 * That can't represent a job like "Queen bed + fridge + side table" where
 * each item has its own size, weight, and assembly needs. Phase 1 of the
 * refactor adds a per-item array (`quote_items` JSONB on the quotes table)
 * with backward-compatible scalar fallback.
 *
 * Enum decisions (locked):
 * - item_category keeps the existing ITEM_CATEGORIES values from
 *   QuoteFormClient.tsx (small_light, standard_furniture, large_heavy,
 *   appliance, oversized, fragile_specialty). Renaming would invalidate
 *   every historic factors_applied JSON.
 * - assembly keeps the existing human-readable ASSEMBLY_OPTIONS values
 *   ("None", "Disassembly at pickup", "Assembly at delivery", "Both"). The
 *   pricing engine already detects via .includes("both") / .includes("assembly")
 *   in src/app/api/quotes/generate/route.ts.
 */

export const SINGLE_ITEM_CATEGORY_VALUES = [
  "small_light",
  "standard_furniture",
  "large_heavy",
  "appliance",
  "oversized",
  "fragile_specialty",
] as const;

export type SingleItemCategory = (typeof SINGLE_ITEM_CATEGORY_VALUES)[number];

/**
 * Client-facing label for an item_category slug. Keeps the same wording
 * the admin form uses (`ITEM_CATEGORIES` in QuoteFormClient.tsx) so the
 * quote page, emails, and contract PDF all read identically. Falls back
 * to a title-cased slug for legacy values not in the canonical set —
 * better than leaking "small_light" raw to a client.
 */
const SINGLE_ITEM_CATEGORY_LABELS: Record<string, string> = {
  small_light: "Small / light",
  standard_furniture: "Standard furniture",
  large_heavy: "Large / heavy",
  appliance: "Heavy appliance",
  oversized: "Oversized",
  fragile_specialty: "Fragile / specialty",
  multiple_2_to_5: "Multiple items",
};

export function formatSingleItemCategoryLabel(
  raw: string | null | undefined,
): string {
  if (!raw) return "Item";
  const key = String(raw).trim().toLowerCase();
  if (!key) return "Item";
  const hit = SINGLE_ITEM_CATEGORY_LABELS[key];
  if (hit) return hit;
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SINGLE_ITEM_ASSEMBLY_VALUES = [
  "None",
  "Disassembly at pickup",
  "Assembly at delivery",
  "Both",
] as const;

export type SingleItemAssembly = (typeof SINGLE_ITEM_ASSEMBLY_VALUES)[number];

export type SingleItemLine = {
  /** Client-generated stable id (nanoid/uuid). Persists across edits so React
   *  keys don't churn and the engine can attribute factors back to a row. */
  id: string;
  item_description: string;
  /** Stored value — see SINGLE_ITEM_CATEGORY_VALUES. */
  item_category: string;
  /** Free string from WEIGHT_CLASSES in QuoteFormClient.tsx; we don't
   *  enforce the enum at this layer because legacy quotes may have ad-hoc
   *  values. The pricing engine treats empty as "infer from category". */
  weight_class: string;
  /** See SINGLE_ITEM_ASSEMBLY_VALUES. Engine reads via .includes("both") /
   *  .includes("assembly") so misspellings are tolerated. */
  assembly: string;
  stair_carry: boolean;
  /** Only meaningful when stair_carry === true. */
  stair_flights?: number;
  /** How many of this exact item line (e.g. "2 identical bedside tables"). */
  quantity: number;
};

/**
 * Cap "Single Item" quotes at 5 distinct items. At 6+ the operator should
 * switch the service to Local Move — single-item pricing wasn't designed
 * for that scope and the per-item ladder reads as over-priced.
 */
export const SINGLE_ITEM_MAX_LINES = 5;

/** Empty line — used for initial state and the "+ Add another item" button. */
export function emptySingleItemLine(): SingleItemLine {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    item_description: "",
    item_category: "standard_furniture",
    weight_class: "",
    assembly: "None",
    stair_carry: false,
    quantity: 1,
  };
}

/**
 * Backward-compatible read: when a quote was created before Phase 1, it has
 * scalar fields only. Synthesize a one-line array from those so every
 * consumer can work in array-first mode.
 */
export type LegacyScalarQuote = {
  item_description?: string | null;
  item_category?: string | null;
  item_weight_class?: string | null;
  assembly_needed?: string | null;
  stair_carry?: boolean | null;
  stair_flights?: number | null;
  number_of_items?: number | null;
};

export function linesFromScalarQuote(q: LegacyScalarQuote): SingleItemLine[] {
  const desc = (q.item_description ?? "").trim();
  if (!desc && !q.item_category) return [];
  return [
    {
      id: "legacy-0",
      item_description: desc,
      item_category: (q.item_category ?? "standard_furniture").toString(),
      weight_class: (q.item_weight_class ?? "").toString(),
      assembly: (q.assembly_needed ?? "None").toString(),
      stair_carry: !!q.stair_carry,
      stair_flights:
        typeof q.stair_flights === "number" && q.stair_flights > 0
          ? q.stair_flights
          : undefined,
      quantity: Math.max(1, Math.floor(Number(q.number_of_items ?? 1))) || 1,
    },
  ];
}

/**
 * Single source of truth for "what items does this quote have?". Reads from
 * the new array first; falls back to scalars. All consumers (engine, layout,
 * email body, HubSpot deal name, crew sheet) must use this — never read
 * quote_items or the scalars directly.
 */
export function resolveSingleItemLines(
  quoteItems: unknown,
  scalars: LegacyScalarQuote,
): SingleItemLine[] {
  if (Array.isArray(quoteItems) && quoteItems.length > 0) {
    return quoteItems
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x, idx) => ({
        id: String(x.id ?? `arr-${idx}`),
        item_description: String(x.item_description ?? ""),
        item_category: String(x.item_category ?? "standard_furniture"),
        weight_class: String(x.weight_class ?? ""),
        assembly: String(x.assembly ?? "None"),
        stair_carry: !!x.stair_carry,
        stair_flights:
          typeof x.stair_flights === "number" && x.stair_flights > 0
            ? x.stair_flights
            : undefined,
        quantity: Math.max(1, Math.floor(Number(x.quantity ?? 1))) || 1,
      }));
  }
  return linesFromScalarQuote(scalars);
}

// ─── Junk-removal stop ───────────────────────────────────────────────────

export const JUNK_PICKUP_FROM_VALUES = ["origin", "destination", "both"] as const;
export type JunkPickupFrom = (typeof JUNK_PICKUP_FROM_VALUES)[number];

/**
 * Junk-removal stop captured at quote time.
 *
 * `pickupFrom` tells the crew where on the move to load the junk.
 * `itemsDescription` is an internal note for the coordinator and crew — it
 * helps the coordinator pick the right tier (Small/Half/Full truck) and
 * gives the crew a heads-up of what to grab on the day.
 *
 * We deliberately do NOT capture a drop-off address. The crew disposes at
 * any facility (incl. Yugo office) on their own schedule. Pricing is the
 * addon tier (covers disposal + truck volume) plus a flat stop-labour fee.
 */
export type JunkRemovalStop = {
  pickupFrom: JunkPickupFrom;
  itemsDescription: string;
};
