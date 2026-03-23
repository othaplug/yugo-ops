/**
 * Pricing Engine v2 — separates Cost drivers from Market drivers.
 *
 * Cost Stack  : base × inventory × distance  (operational reality)
 * Market Stack: neighbourhood × day × season × urgency  (price perception, capped)
 *
 * This module exports pure calculation helpers used by the API route
 * (src/app/api/quotes/generate/route.ts) and the admin quote preview.
 */

// ═══════════════════════════════════════════════
// Config helpers (accepts both Map and Record)
// ═══════════════════════════════════════════════

type ConfigMap = Map<string, string> | Record<string, string>;

export function cfgNum(config: ConfigMap, key: string, fallback: number): number {
  const v = config instanceof Map ? config.get(key) : config[key];
  return v !== undefined ? Number(v) : fallback;
}

export function cfgStr(config: ConfigMap, key: string, fallback: string): string {
  const v = config instanceof Map ? config.get(key) : config[key];
  return v ?? fallback;
}

export function cfgJson<T>(config: ConfigMap, key: string, fallback: T): T {
  try {
    const v = config instanceof Map ? config.get(key) : config[key];
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ═══════════════════════════════════════════════
// Minimum hours floor per move size (Section 2)
// ═══════════════════════════════════════════════

const MIN_HOURS_DEFAULTS: Record<string, number> = {
  studio: 2,
  "1br": 3,
  "2br": 4,
  "3br": 5.5,
  "4br": 7,
  "5br_plus": 8.5,
  partial: 2,
};

export function getMinHoursFloor(moveSize: string, config: ConfigMap): number {
  const floors = cfgJson<Record<string, number>>(config, "minimum_hours_by_size", {});
  return floors[moveSize] ?? MIN_HOURS_DEFAULTS[moveSize] ?? 3;
}

// ═══════════════════════════════════════════════
// Market Stack cap helper (Section 1, Step 4)
// ═══════════════════════════════════════════════

export function applyMarketStackCap(
  neighbourhoodMult: number,
  dateMult: number,
  config: ConfigMap,
): { raw: number; capped: number; wasCapped: boolean } {
  const cap = cfgNum(config, "market_stack_cap", 1.38);
  const raw = neighbourhoodMult * dateMult;
  const capped = Math.min(raw, cap);
  return { raw, capped, wasCapped: raw > cap };
}

// ═══════════════════════════════════════════════
// Tiered labour rates (Section 1, Step 6)
// ═══════════════════════════════════════════════

export interface TieredLabourRates {
  essential: number;
  signature: number;
  estate: number;
}

export function getLabourRates(config: ConfigMap): TieredLabourRates {
  return {
    essential: cfgNum(config, "labour_rate_essential", cfgNum(config, "labour_rate_curated", 55)),
    signature: cfgNum(config, "labour_rate_signature", 65),
    estate: cfgNum(config, "labour_rate_estate", 75),
  };
}

/**
 * Calculate per-tier labour delta for hours over baseline.
 * Returns $0 for negative deltas (light moves don't double-discount).
 */
export function calcTieredLabourDelta(
  extraHours: number,
  crew: number,
  rates: TieredLabourRates,
): { essential: number; signature: number; estate: number } {
  const safe = Math.max(0, extraHours);
  return {
    essential: Math.max(0, Math.round(safe * crew * rates.essential)),
    signature: Math.max(0, Math.round(safe * crew * rates.signature)),
    estate: Math.max(0, Math.round(safe * crew * rates.estate)),
  };
}

// ═══════════════════════════════════════════════
// Deadhead + mobilization helpers (Section 1)
// ═══════════════════════════════════════════════

export function calcDeadheadCost(distanceFromHqKm: number, config: ConfigMap): number {
  const freeZone = cfgNum(config, "deadhead_free_zone_km", cfgNum(config, "deadhead_free_km", 15));
  const rate = cfgNum(config, "deadhead_rate_per_km", cfgNum(config, "deadhead_per_km", 3.0));
  if (distanceFromHqKm <= freeZone) return 0;
  return Math.round((distanceFromHqKm - freeZone) * rate);
}

export function calcMobilizationFee(distanceFromHqKm: number, config: ConfigMap): number {
  if (distanceFromHqKm > 50) return cfgNum(config, "mobilization_50plus", 100);
  if (distanceFromHqKm > 35) return cfgNum(config, "mobilization_35_50", 75);
  if (distanceFromHqKm > 25) return cfgNum(config, "mobilization_25_35", 50);
  return 0;
}

// ═══════════════════════════════════════════════
// Estimated cost model (for margin calculation)
// ═══════════════════════════════════════════════

export interface EstimatedCost {
  labour: number;
  truck: number;
  fuel: number;
  supplies: number;
  total: number;
}

export interface EstimatedCostInput {
  actualEstimatedHours: number;
  crew: number;
  recommendedTruck: string;
  distanceKm: number;
  tier: string;
  moveSize: string;
}

export function calcEstimatedCost(
  input: EstimatedCostInput,
  config: ConfigMap,
): EstimatedCost {
  const costPerMoverHour = cfgNum(config, "cost_per_mover_hour", 33);
  const truckCosts = cfgJson<Record<string, number>>(
    config,
    "truck_costs_per_job",
    { sprinter: 90, "16ft": 115, "20ft": 150, "24ft": 175, "26ft": 200 },
  );
  const fuelCostPerKm = cfgNum(config, "fuel_cost_per_km", 0.45);

  const labour = Math.round(input.actualEstimatedHours * input.crew * costPerMoverHour);
  const truck = truckCosts[input.recommendedTruck] ?? 115;
  const fuel = Math.round(input.distanceKm * 2 * fuelCostPerKm);

  // Estate supplies allowance
  const ESTATE_SUPPLIES_FALLBACK: Record<string, number> = {
    studio: 250, "1br": 300, "2br": 375, "3br": 575, "4br": 850, "5br_plus": 1100, partial: 150,
  };
  const suppliesBySize = cfgJson<Record<string, number>>(config, "estate_supplies_by_size", {});
  const supplies = input.tier === "estate"
    ? (suppliesBySize[input.moveSize] ?? ESTATE_SUPPLIES_FALLBACK[input.moveSize] ?? 375)
    : 0;

  return { labour, truck, fuel, supplies, total: labour + truck + fuel + supplies };
}

export function calcEstimatedMarginPct(revenue: number, cost: EstimatedCost): number {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - cost.total) / revenue) * 100);
}

// ═══════════════════════════════════════════════
// Margin flag
// ═══════════════════════════════════════════════

export type MarginFlag = "green" | "yellow" | "red";

export function getMarginFlag(marginPct: number): MarginFlag {
  if (marginPct < 25) return "red";
  if (marginPct < 35) return "yellow";
  return "green";
}

// ═══════════════════════════════════════════════
// Margin warning (shown on admin quote preview)
// ═══════════════════════════════════════════════

export interface MarginWarning {
  level: "warning" | "critical";
  message: string;
  estimated_margin: number;
  target_margin: number;
  signature_margin: number | null;
}

/**
 * Returns a MarginWarning if margin is below the configured warning threshold,
 * or null when margin is healthy.  Signature margin is shown for comparison so
 * the coordinator can see how much better the higher tier looks.
 */
export function calcMarginWarning(
  tier: string,
  estimatedMargin: number,
  config: ConfigMap,
  signatureRevenue?: number,
  estimatedCost?: EstimatedCost,
): MarginWarning | null {
  const targetKey = tier === "estate"
    ? "margin_target_estate"
    : tier === "signature"
      ? "margin_target_signature"
      : "margin_target_essential";
  const marginTarget = cfgNum(config, targetKey, tier === "estate" ? 55 : tier === "signature" ? 48 : 40);
  const marginWarning = cfgNum(config, "margin_warning_threshold", 35);
  const marginCritical = cfgNum(config, "margin_critical_threshold", 25);

  if (estimatedMargin >= marginWarning) return null;

  const level: "warning" | "critical" = estimatedMargin < marginCritical ? "critical" : "warning";
  const message = level === "critical"
    ? `Estimated margin ${estimatedMargin}% is critically low (threshold: ${marginCritical}%). Review pricing or recommend Signature.`
    : `Estimated margin ${estimatedMargin}% is below target ${marginTarget}%. Consider adjusting.`;

  let signatureMargin: number | null = null;
  if (signatureRevenue && estimatedCost) {
    signatureMargin = signatureRevenue > 0
      ? Math.round(((signatureRevenue - estimatedCost.total) / signatureRevenue) * 100)
      : null;
  }

  return { level, message, estimated_margin: estimatedMargin, target_margin: marginTarget, signature_margin: signatureMargin };
}

// ═══════════════════════════════════════════════
// Actual margin calculation (run on move completion)
// ═══════════════════════════════════════════════

export interface ActualCostInput {
  actualHours: number | null;
  estimatedHours: number | null;
  actualCrew: number | null;
  crewSize: number | null;
  truckType: string | null;
  distanceKm: number | null;
  tier: string | null;
  moveSize: string | null;
  totalPrice: number | null;
}

export interface ActualMarginResult {
  actual_labour_cost: number;
  actual_truck_cost: number;
  actual_fuel_cost: number;
  actual_supplies_cost: number;
  total_cost: number;
  gross_profit: number;
  margin_percent: number;
  margin_flag: MarginFlag;
}

export function calcActualMargin(
  move: ActualCostInput,
  config: ConfigMap,
): ActualMarginResult {
  const hours = move.actualHours ?? move.estimatedHours ?? 4;
  const crew = move.actualCrew ?? move.crewSize ?? 2;
  const truck = (move.truckType ?? "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  const distanceKm = move.distanceKm ?? 20;
  const tier = move.tier ?? "essential";
  const moveSize = move.moveSize ?? "2br";
  const revenue = move.totalPrice ?? 0;

  const costInput: EstimatedCostInput = {
    actualEstimatedHours: hours,
    crew,
    recommendedTruck: truck,
    distanceKm,
    tier,
    moveSize,
  };

  const cost = calcEstimatedCost(costInput, config);
  const profit = revenue - cost.total;
  const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return {
    actual_labour_cost: cost.labour,
    actual_truck_cost: cost.truck,
    actual_fuel_cost: cost.fuel,
    actual_supplies_cost: cost.supplies,
    total_cost: cost.total,
    gross_profit: profit,
    margin_percent: marginPct,
    margin_flag: getMarginFlag(marginPct),
  };
}
