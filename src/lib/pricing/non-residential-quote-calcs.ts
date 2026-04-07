/**
 * Deterministic pricing helpers for non-residential quote service types.
 * Used by `src/app/api/quotes/generate/route.ts` — keep free of Next/HTTP imports.
 */

export type PricingConfigMap = Map<string, string>;

function cfgNum(config: PricingConfigMap, key: string, fallback: number): number {
  const v = config.get(key);
  return v !== undefined ? Number(v) : fallback;
}

export function estimateOfficeCrew(workstations: number): number {
  if (workstations <= 10) return 2;
  if (workstations <= 25) return 3;
  if (workstations <= 50) return 4;
  if (workstations <= 100) return 6;
  return 8;
}

export type OfficeScheduleFlags = {
  serverRoom: boolean;
  boardroomCount: number;
  kitchen: boolean;
  reception: boolean;
};

export function estimateOfficeHours(workstations: number, flags: OfficeScheduleFlags): number {
  let hours = (workstations * 20) / 60;
  if (flags.serverRoom) hours += 3;
  if (flags.boardroomCount > 0) hours += 1 * flags.boardroomCount;
  if (flags.kitchen) hours += 1;
  if (flags.reception) hours += 0.5;
  return Math.max(Math.round(hours * 2) / 2, 3);
}

export type TruckKey = "sprinter" | "16ft" | "20ft" | "24ft" | "26ft" | "none";

const OFFICE_TRUCK_SURCHARGES: Record<TruckKey, number> = {
  sprinter: 0,
  "16ft": 75,
  "20ft": 150,
  "24ft": 200,
  "26ft": 250,
  none: 0,
};

export function officeTruckSurchargeStack(truck: TruckKey, truckCount: number): number {
  const base = OFFICE_TRUCK_SURCHARGES[truck] ?? 0;
  if (truckCount <= 1) return base;
  return base + (truckCount - 1) * (base + 200);
}

export function estimateOfficeTruckOpsCost(truck: TruckKey, truckCount: number): number {
  const perTruck: Record<TruckKey, number> = {
    sprinter: 45,
    "16ft": 85,
    "20ft": 120,
    "24ft": 140,
    "26ft": 165,
    none: 0,
  };
  const unit = perTruck[truck] ?? 85;
  return unit * Math.max(1, truckCount);
}

/** Map form `item_category` + weight hint to single-item pricing bucket. */
export function singleItemPricingCategory(
  itemCategory: string | undefined,
  itemWeightClass: string | undefined,
):
  | "small_light"
  | "medium"
  | "large"
  | "heavy"
  | "extra_heavy"
  | "fragile" {
  const cat = (itemCategory || "").toLowerCase();
  const w = (itemWeightClass || "").toLowerCase();

  if (cat === "small_light" || cat.includes("small_light")) return "small_light";
  if (cat.includes("fragile") || cat.includes("specialty")) return "fragile";
  if (cat.includes("oversized") || w.includes("over 500")) return "extra_heavy";
  if (cat.includes("appliance") || w.includes("300-500") || w.includes("300–500")) return "heavy";
  if (cat.includes("large") || cat.includes("heavy")) return "large";
  if (cat.includes("multiple")) return "medium";
  if (cat.includes("standard")) return "medium";
  if (w.includes("over 500")) return "extra_heavy";
  if (w.includes("300")) return "heavy";
  if (w.includes("150-300") || w.includes("150–300")) return "large";
  if (w.includes("50-150") || w.includes("50–150")) return "medium";
  if (w.includes("under 50")) return "small_light";
  return "medium";
}

export function singleItemWalkUpSurcharge(accessType: string | undefined, config: PricingConfigMap): number {
  const k = (accessType || "").toLowerCase().trim();
  if (!k) return 0;
  if (k === "walk_up_2nd" || k.includes("walk_up_2")) return cfgNum(config, "single_item_walk_up_2nd", 30);
  if (k === "walk_up_3rd" || k.includes("walk_up_3")) return cfgNum(config, "single_item_walk_up_3rd", 50);
  if (k === "walk_up_4th_plus" || k.includes("walk_up_4")) return cfgNum(config, "single_item_walk_up_4th", 75);
  return 0;
}

export function estimateSingleItemHours(category: string, itemCount: number, assembly: boolean): number {
  let h = 2;
  if (category === "large" || category === "heavy") h += 0.5;
  if (category === "extra_heavy") h += 1.5;
  if (category === "fragile") h += 0.5;
  if (itemCount > 1) h += (itemCount - 1) * 0.25;
  if (assembly) h += 0.75;
  return Math.max(Math.round(h * 2) / 2, 2);
}

export function whiteGloveWrapAndAssemblyCounts(input: {
  inventory_items?: { fragile?: boolean; quantity?: number }[];
  assembly_needed?: string;
}): { wrapQty: number; assemblyQty: number } {
  const items = input.inventory_items ?? [];
  let wrapQty = 0;
  for (const row of items) {
    const q = Math.max(1, Number(row.quantity) || 1);
    if (row.fragile) wrapQty += q;
  }
  const asm = (input.assembly_needed ?? "none").toLowerCase();
  const assemblyNeeded = asm.includes("both") || asm.includes("assembly") || asm.includes("disassembly");
  const assemblyQty = assemblyNeeded ? Math.max(1, items.length || 1) : 0;
  return { wrapQty, assemblyQty };
}

export function estimateWhiteGloveHours(input: {
  inventory_items?: { quantity?: number }[];
  distance_km: number;
  wrapQty: number;
  assemblyQty: number;
}): number {
  const n = input.inventory_items?.reduce((s, r) => s + Math.max(1, Number(r.quantity) || 1), 0) ?? 1;
  let h = 2 + Math.min(6, n) * 0.35;
  if (input.distance_km > 25) h += 0.5;
  if (input.distance_km > 45) h += 0.5;
  h += input.wrapQty * 0.15;
  h += input.assemblyQty * 0.5;
  return Math.max(Math.round(h * 2) / 2, 2);
}
