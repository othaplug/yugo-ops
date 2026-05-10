/**
 * Item-intelligence assembly detection.
 *
 * Uses the assembly_complexity field on item_weights records to decide
 * whether a quote job requires assembly / disassembly, and by how many minutes.
 * Assembly is NOT a separate fee — it feeds the hours estimate which feeds labour cost.
 */

export type AssemblyComplexity = "none" | "simple" | "moderate" | "complex" | "specialist";

export interface AssemblyItemWeight {
  slug: string;
  item_name: string;
  assembly_complexity?: AssemblyComplexity | string | null;
  disassembly_required?: boolean | null;
}

export interface QuoteInventoryItem {
  slug?: string | null;
  name?: string | null;
  item_name?: string | null;
  quantity?: number | null;
}

/** Minutes to reassemble at destination, by complexity. */
const ASSEMBLY_MINUTES: Record<AssemblyComplexity, number> = {
  none: 0,
  simple: 20,      // basic bed frame, simple desk
  moderate: 35,    // platform bed, standing desk, TV stand with doors
  complex: 55,     // storage bed (hydraulic), L-desk, large wardrobe
  specialist: 0,   // quoted separately — don't auto-add time
};

/** Minutes to disassemble at origin (slightly faster — no instructions). */
const DISASSEMBLY_MINUTES: Record<AssemblyComplexity, number> = {
  none: 0,
  simple: 15,
  moderate: 25,
  complex: 40,
  specialist: 0,
};

function normalizeComplexity(raw: string | null | undefined): AssemblyComplexity {
  const v = (raw ?? "none").toLowerCase().trim();
  if (v === "simple" || v === "moderate" || v === "complex" || v === "specialist") {
    return v as AssemblyComplexity;
  }
  return "none";
}

/** Detect whether any inventory items require assembly/disassembly. */
export function detectAssemblyRequired(
  inventoryItems: QuoteInventoryItem[],
  itemWeightsDb: AssemblyItemWeight[],
): {
  required: boolean;
  itemsRequiringAssembly: string[];
  confidence: "certain" | "likely" | "none";
} {
  if (!inventoryItems?.length) {
    return { required: false, itemsRequiringAssembly: [], confidence: "none" };
  }

  const assemblyItems: string[] = [];

  for (const item of inventoryItems) {
    const slug = item.slug ?? "";
    const nameRaw = (item.name ?? item.item_name ?? "").toLowerCase();
    const dbItem = itemWeightsDb.find(
      (iw) =>
        (slug && iw.slug === slug) ||
        iw.item_name.toLowerCase() === nameRaw,
    );
    if (!dbItem) continue;

    const complexity = normalizeComplexity(dbItem.assembly_complexity);
    if (complexity !== "none" && complexity !== "specialist") {
      const displayName = dbItem.item_name;
      // Deduplicate by name
      if (!assemblyItems.includes(displayName)) {
        assemblyItems.push(displayName);
      }
    }
  }

  if (assemblyItems.length === 0) {
    return { required: false, itemsRequiringAssembly: [], confidence: "certain" };
  }

  return {
    required: true,
    itemsRequiringAssembly: assemblyItems,
    confidence: assemblyItems.length >= 2 ? "certain" : "likely",
  };
}

/**
 * Calculate total assembly + disassembly minutes for a set of inventory items.
 * Used to inflate the hours estimate in the pricing engine.
 */
export function calcAssemblyMinutes(
  inventoryItems: QuoteInventoryItem[],
  itemWeightsDb: AssemblyItemWeight[],
): {
  totalMinutes: number;
  breakdown: { itemName: string; minutes: number }[];
} {
  let totalMinutes = 0;
  const breakdown: { itemName: string; minutes: number }[] = [];

  for (const item of inventoryItems) {
    const slug = item.slug ?? "";
    const nameRaw = (item.name ?? item.item_name ?? "").toLowerCase();
    const dbItem = itemWeightsDb.find(
      (iw) =>
        (slug && iw.slug === slug) ||
        iw.item_name.toLowerCase() === nameRaw,
    );
    if (!dbItem) continue;

    const complexity = normalizeComplexity(dbItem.assembly_complexity);
    if (complexity === "none" || complexity === "specialist") continue;

    const qty = Math.max(1, item.quantity ?? 1);
    const assemblyMins = ASSEMBLY_MINUTES[complexity];
    const disassemblyMins = dbItem.disassembly_required
      ? DISASSEMBLY_MINUTES[complexity]
      : 0;
    const itemMinutes = (assemblyMins + disassemblyMins) * qty;

    if (itemMinutes > 0) {
      totalMinutes += itemMinutes;
      breakdown.push({ itemName: dbItem.item_name, minutes: itemMinutes });
    }
  }

  return { totalMinutes, breakdown };
}
