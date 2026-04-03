/**
 * Shared weight tier model for B2B line items and B2C residential inventory.
 * Canonical codes are stored on quotes / inventory; legacy medium/extra_heavy normalize on read.
 */

export const WEIGHT_TIER_CODES = [
  "light",
  "standard",
  "heavy",
  "very_heavy",
  "super_heavy",
  "extreme",
] as const;

export type WeightTierCode = (typeof WEIGHT_TIER_CODES)[number];

export type WeightTierDefinition = {
  code: WeightTierCode;
  label: string;
  range: string;
  minLbs: number;
  maxLbs: number | null;
  crewImpact: number;
  priceFactor: number;
  examples: string;
  requiresEquipment?: string[];
  manualWeightRequired?: boolean;
  requiresReview?: boolean;
  perLbRate?: number;
};

export const WEIGHT_TIERS: readonly WeightTierDefinition[] = [
  {
    code: "light",
    label: "Light",
    range: "Under 50 lbs",
    minLbs: 0,
    maxLbs: 50,
    crewImpact: 0,
    priceFactor: 1.0,
    examples: "Lamp, side table, small box, cushions, decor",
  },
  {
    code: "standard",
    label: "Standard",
    range: "50–150 lbs",
    minLbs: 50,
    maxLbs: 150,
    crewImpact: 0,
    priceFactor: 1.0,
    examples: "Dining chair, nightstand, small dresser, TV",
  },
  {
    code: "heavy",
    label: "Heavy",
    range: "150–300 lbs",
    minLbs: 150,
    maxLbs: 300,
    crewImpact: 0,
    priceFactor: 1.15,
    examples: "Sofa, dining table, dresser, washer/dryer",
  },
  {
    code: "very_heavy",
    label: "Very Heavy",
    range: "300–500 lbs",
    minLbs: 300,
    maxLbs: 500,
    crewImpact: 1,
    priceFactor: 1.35,
    examples: "Fridge, piano (upright), safe, marble table",
    requiresEquipment: ["furniture dolly", "appliance dolly"],
  },
  {
    code: "super_heavy",
    label: "Super Heavy",
    range: "500–800 lbs",
    minLbs: 500,
    maxLbs: 800,
    crewImpact: 2,
    priceFactor: 1.75,
    examples: "Grand piano, large safe, stone countertop",
    requiresEquipment: ["furniture dolly", "stair climber", "lift gate"],
    manualWeightRequired: true,
  },
  {
    code: "extreme",
    label: "Extreme",
    range: "Over 800 lbs",
    minLbs: 800,
    maxLbs: null,
    crewImpact: 3,
    priceFactor: 2.5,
    examples: "Gun safe, marble slab, hot tub, pool table (slate)",
    requiresEquipment: ["hydraulic lift", "crane", "lift gate"],
    manualWeightRequired: true,
    requiresReview: true,
    perLbRate: 0.5,
  },
] as const;

const TIER_BY_CODE: Record<string, WeightTierDefinition> = Object.fromEntries(
  WEIGHT_TIERS.map((t) => [t.code, t]),
) as Record<string, WeightTierDefinition>;

export function getWeightTier(code: string | undefined | null): WeightTierDefinition | null {
  if (!code) return null;
  const c = normalizeB2bWeightCategory(code);
  return TIER_BY_CODE[c] ?? null;
}

/**
 * Map legacy and alias strings to a canonical WeightTierCode.
 */
export function normalizeB2bWeightCategory(raw: string | undefined | null): WeightTierCode {
  const c = (raw || "").trim().toLowerCase().replace(/-/g, "_");
  if (
    c === "light" ||
    c === "standard" ||
    c === "heavy" ||
    c === "very_heavy" ||
    c === "super_heavy" ||
    c === "extreme"
  ) {
    return c as WeightTierCode;
  }
  if (c === "medium") return "standard";
  if (c === "extra_heavy" || c === "oversized_fragile") return "very_heavy";
  if (c === "very heavy") return "very_heavy";
  if (c === "super heavy") return "super_heavy";
  return "standard";
}

/** Midpoint or actual lbs for truck / load estimates. */
export function estimateLineWeightLbs(args: {
  weight_category?: string | null;
  weight_lbs?: number | null;
  actual_weight_lbs?: number | null;
}): number {
  const explicit =
    args.actual_weight_lbs != null && Number.isFinite(args.actual_weight_lbs) && args.actual_weight_lbs > 0
      ? args.actual_weight_lbs
      : args.weight_lbs != null && Number.isFinite(args.weight_lbs) && args.weight_lbs > 0
        ? args.weight_lbs
        : null;
  if (explicit != null) return explicit;
  const tier = getWeightTier(args.weight_category);
  if (!tier) return 75;
  const max = tier.maxLbs;
  if (max == null) return tier.minLbs + 400;
  return (tier.minLbs + max) / 2;
}

export interface WeightSurchargeLineResult {
  surcharge: number;
  percentSurcharge: number;
  crew_impact: number;
  equipment: string[];
  percentLabel: string;
  perLbPortion: number;
}

export function calculateWeightSurchargeForLine(args: {
  weight_category: string | undefined | null;
  basePricePerItem: number;
  quantity: number;
  actual_weight_lbs?: number | null;
  weight_lbs?: number | null;
}): WeightSurchargeLineResult {
  const tier = getWeightTier(args.weight_category);
  const q = Math.max(1, args.quantity || 1);
  const base = Math.max(0, args.basePricePerItem);
  if (!tier) {
    return {
      surcharge: 0,
      percentSurcharge: 0,
      crew_impact: 0,
      equipment: [],
      percentLabel: "",
      perLbPortion: 0,
    };
  }
  const unitBase = base * q;
  const percentSurcharge = Math.round(unitBase * (tier.priceFactor - 1.0) * 100) / 100;
  let perLbPortion = 0;
  if (tier.perLbRate != null && tier.code === "extreme") {
    const lbs =
      args.actual_weight_lbs != null && Number.isFinite(args.actual_weight_lbs) && args.actual_weight_lbs > 0
        ? args.actual_weight_lbs
        : args.weight_lbs != null && Number.isFinite(args.weight_lbs) && args.weight_lbs > 0
          ? args.weight_lbs
          : null;
    if (lbs != null && lbs > tier.minLbs) {
      perLbPortion = Math.round((lbs - tier.minLbs) * tier.perLbRate * q * 100) / 100;
    }
  }
  const surcharge = Math.round((percentSurcharge + perLbPortion) * 100) / 100;
  return {
    surcharge,
    percentSurcharge,
    crew_impact: tier.crewImpact ?? 0,
    equipment: tier.requiresEquipment ? [...tier.requiresEquipment] : [],
    percentLabel:
      tier.priceFactor > 1 ? `+${Math.round((tier.priceFactor - 1) * 100)}%` : "",
    perLbPortion,
  };
}

export function recommendCrewFromWeightItems(
  items: Array<{ weight_category?: string | null; quantity?: number }>,
  baseCrew = 2,
): number {
  let maxCrewImpact = 0;
  for (const item of items) {
    const tier = getWeightTier(item.weight_category);
    if (tier && (tier.crewImpact || 0) > maxCrewImpact) {
      maxCrewImpact = tier.crewImpact || 0;
    }
  }
  const totalItems = items.reduce((s, i) => s + Math.max(1, i.quantity ?? 1), 0);
  let crew = baseCrew;
  if (totalItems > 30) crew = Math.max(crew, 3);
  if (totalItems > 80) crew = Math.max(crew, 4);
  return crew + maxCrewImpact;
}

const TRUCK_RANK: Record<string, number> = {
  sprinter: 0,
  "16ft": 1,
  "20ft": 2,
  "24ft": 3,
  "26ft": 4,
};

export function pickLargerTruck(a: string, b: string): string {
  const na = TRUCK_RANK[a] ?? -1;
  const nb = TRUCK_RANK[b] ?? -1;
  return nb > na ? b : a;
}

export function recommendTruckFromWeightItems(
  items: Array<{
    weight_category?: string | null;
    actual_weight_lbs?: number | null;
    weight_lbs?: number | null;
    quantity?: number;
  }>,
): { truck: string; needsLiftGateNote: boolean } {
  const totalWeight = items.reduce((sum, item) => {
    const w = estimateLineWeightLbs({
      weight_category: item.weight_category,
      weight_lbs: item.weight_lbs,
      actual_weight_lbs: item.actual_weight_lbs,
    });
    return sum + w * Math.max(1, item.quantity ?? 1);
  }, 0);

  const hasLiftGateNeeded = items.some((i) => {
    const tier = getWeightTier(i.weight_category);
    return tier?.requiresEquipment?.some((e) => e.toLowerCase().includes("lift gate")) ?? false;
  });

  let truck = "sprinter";
  if (hasLiftGateNeeded || totalWeight > 3000) truck = "26ft";
  else if (totalWeight > 1500) truck = "20ft";
  else if (totalWeight > 500) truck = "16ft";

  return { truck, needsLiftGateNote: hasLiftGateNeeded || totalWeight > 3000 };
}

export function hasExtremeWeightCategory(
  items: Array<{ weight_category?: string | null }>,
): boolean {
  return items.some((i) => normalizeB2bWeightCategory(i.weight_category ?? undefined) === "extreme");
}

export function tierRequiresActualWeight(code: string | undefined | null): boolean {
  const t = getWeightTier(code);
  return !!(t?.manualWeightRequired || t?.requiresReview);
}

/** Map legacy inventory weight_score (0.3–3) to a default tier for new UI. */
export function inferWeightTierFromLegacyScore(score: number): WeightTierCode {
  if (!Number.isFinite(score)) return "standard";
  if (score <= 0.5) return "light";
  if (score <= 1.0) return "standard";
  if (score <= 1.75) return "heavy";
  if (score <= 2.25) return "very_heavy";
  if (score < 3.0) return "super_heavy";
  return "extreme";
}

export function residentialInventoryLineScore(item: {
  weight_score: number;
  quantity: number;
  weight_tier_code?: string | null;
}): number {
  const tierCode =
    item.weight_tier_code != null && item.weight_tier_code !== ""
      ? normalizeB2bWeightCategory(item.weight_tier_code)
      : inferWeightTierFromLegacyScore(item.weight_score);
  const tier = getWeightTier(tierCode);
  const factor = tier?.priceFactor ?? 1.0;
  return item.weight_score * factor * Math.max(1, item.quantity);
}

export function weightTierSelectOptions(): Array<{
  value: WeightTierCode;
  label: string;
  shortHint: string;
}> {
  return WEIGHT_TIERS.map((t) => ({
    value: t.code,
    label: `${t.label} — ${t.range}`,
    shortHint:
      t.priceFactor > 1
        ? `+${Math.round((t.priceFactor - 1) * 100)}%`
        : "Base",
  }));
}
