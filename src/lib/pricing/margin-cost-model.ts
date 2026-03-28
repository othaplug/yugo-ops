/**
 * Operational cost estimates for admin margin preview (not client-facing prices).
 * Uses platform_config keys with documented fallbacks.
 */

type PricingConfig = Map<string, string> | Record<string, string>;

function cfgNum(config: PricingConfig, key: string, fallback: number): number {
  const v = config instanceof Map ? config.get(key) : (config as Record<string, string>)[key];
  if (v === undefined || v === "" || Number.isNaN(Number(v))) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface OperationalSuppliesItem {
  name?: string;
  quantity?: number;
  weight_score?: number;
  fragile?: boolean;
}

/** Expected inventory score by move size (for volume modifier dampening). */
export function expectedInventoryScoreForMoveSize(moveSize: string, config: PricingConfig): number {
  const keyBySize: Record<string, string> = {
    studio: "expected_score_studio",
    partial: "expected_score_partial",
    "1br": "expected_score_1br",
    "2br": "expected_score_2br",
    "3br": "expected_score_3br",
    "4br": "expected_score_4br",
    "5br_plus": "expected_score_5br_plus",
  };
  const cfgKey = keyBySize[moveSize];
  if (cfgKey) {
    const fromCfg = cfgNum(config, cfgKey, NaN);
    if (!Number.isNaN(fromCfg) && fromCfg > 0) return fromCfg;
  }
  const defaults: Record<string, number> = {
    studio: 12,
    partial: 12,
    "1br": 28,
    "2br": 45,
    "3br": 65,
    "4br": 90,
    "5br_plus": 120,
  };
  return defaults[moveSize] ?? 28;
}

/**
 * Dampened inventory modifier: dead zone ±20%, 50% dampening outside band,
 * floor/ceiling from config.
 */
export function calculateDampenedInventoryModifier(
  actualScore: number,
  moveSize: string,
  config: PricingConfig,
): number {
  const expected = expectedInventoryScoreForMoveSize(moveSize, config);
  if (actualScore <= 0 || expected <= 0) return 1.0;

  const ratio = actualScore / expected;
  const deadZone = cfgNum(config, "inventory_modifier_dead_zone", 0.2);
  const dampening = cfgNum(config, "inventory_modifier_dampening", 0.5);
  const lowBound = 1.0 - deadZone;
  const highBound = 1.0 + deadZone;

  if (ratio >= lowBound && ratio <= highBound) return 1.0;

  const floorM = cfgNum(config, "inventory_modifier_floor", 0.78);
  const ceilingM = cfgNum(config, "inventory_modifier_ceiling", 1.25);

  if (ratio < lowBound) {
    const rawReduction = 1.0 - ratio;
    const dampenedReduction = rawReduction * dampening;
    const modifier = 1.0 - dampenedReduction;
    return Math.round(Math.max(floorM, modifier) * 100) / 100;
  }

  if (ratio > highBound) {
    const rawIncrease = ratio - 1.0;
    const dampenedIncrease = rawIncrease * dampening;
    const modifier = 1.0 + dampenedIncrease;
    return Math.round(Math.min(ceilingM, modifier) * 100) / 100;
  }

  return 1.0;
}

function qtyOf(item: OperationalSuppliesItem): number {
  const q = item.quantity;
  return typeof q === "number" && q > 0 ? q : 1;
}

/** Yugo operational supplies only (not packing add-on materials). */
export function estimateOperationalSuppliesCost(items: OperationalSuppliesItem[]): number {
  let cost = 8 + 3 + 5 + 2;

  const name = (n: string | undefined) => (n || "").toLowerCase();

  let heavyItems = 0;
  let fragileItems = 0;
  let mattresses = 0;

  for (const i of items) {
    const n = name(i.name);
    const q = qtyOf(i);
    const ws = typeof i.weight_score === "number" ? i.weight_score : 1;

    const heavy =
      ws >= 2 ||
      /sofa|couch|bed|dresser|fridge|refrigerator|washer|dryer|piano|armoire|wardrobe/i.test(n) ||
      (/desk/i.test(n) && /large|executive|l-shaped/i.test(n));
    if (heavy) heavyItems += q;

    const fragile =
      !!i.fragile ||
      /mirror|glass|art|antique|tv|television|monitor|lamp|vase|china|picture|frame|sculpture/i.test(n);
    if (fragile) fragileItems += q;

    if (/mattress/i.test(n)) mattresses += q;
  }

  cost += heavyItems * 2;
  cost += fragileItems * 3;
  cost += mattresses * 5;

  return Math.round(cost);
}

const TRUCK_DAILY_CFG_KEYS: Record<string, string> = {
  sprinter: "truck_daily_cost_sprinter",
  "16ft": "truck_daily_cost_16ft",
  "20ft": "truck_daily_cost_20ft",
  "24ft": "truck_daily_cost_24ft",
  "26ft": "truck_daily_cost_26ft",
  none: "truck_daily_cost_sprinter",
};

const TRUCK_DAILY_DEFAULTS: Record<string, number> = {
  sprinter: 85,
  "16ft": 100,
  "20ft": 115,
  "24ft": 115,
  "26ft": 135,
  none: 0,
};

/** Per-move truck cost = daily cost / average moves per truck per day. */
export function estimateTruckCostPerMove(truckType: string, config: PricingConfig): number {
  const k = (truckType || "16ft").toLowerCase().replace(/\s+/g, "") as keyof typeof TRUCK_DAILY_CFG_KEYS;
  const normalized =
    k === "sprinter" || k === "16ft" || k === "20ft" || k === "24ft" || k === "26ft" || k === "none"
      ? k
      : "16ft";
  if (normalized === "none") return 0;

  const cfgKey = TRUCK_DAILY_CFG_KEYS[normalized];
  const dailyDefault = TRUCK_DAILY_DEFAULTS[normalized] ?? 100;
  const dailyCost = cfgNum(config, cfgKey, dailyDefault);
  const utilization = cfgNum(config, "avg_moves_per_truck_per_day", 1.5);
  const u = utilization > 0 ? utilization : 1.5;
  return Math.round(dailyCost / u);
}

const FUEL_L_PER_100KM: Record<string, number> = {
  sprinter: 12,
  "16ft": 18,
  "20ft": 22,
  "24ft": 22,
  "26ft": 28,
  none: 12,
};

/** Fuel for loaded leg plus average deadhead (base ↔ job). */
export function estimateFuelCostWithDeadhead(
  distanceKm: number,
  truckType: string,
  config: PricingConfig,
): number {
  const k = (truckType || "16ft").toLowerCase().replace(/\s+/g, "") as keyof typeof FUEL_L_PER_100KM;
  const normalized =
    k === "sprinter" || k === "16ft" || k === "20ft" || k === "24ft" || k === "26ft" || k === "none"
      ? k
      : "16ft";
  const litersPer100 = FUEL_L_PER_100KM[normalized] ?? 18;
  const litersPerKm = litersPer100 / 100;
  const fuelPrice = cfgNum(config, "fuel_price_per_litre", 1.65);
  const deadheadKm = cfgNum(config, "avg_deadhead_km", 15);
  const totalKm = Math.max(0, distanceKm) + deadheadKm;
  return Math.round(totalKm * litersPerKm * fuelPrice * 100) / 100;
}

/** Loaded crew cost rate ($/mover-hour) for margin model. */
export function crewLoadedHourlyRate(config: PricingConfig): number {
  return cfgNum(config, "crew_loaded_hourly_rate", cfgNum(config, "cost_per_mover_hour", 28));
}
