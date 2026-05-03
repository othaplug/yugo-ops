/**
 * Pricing Engine v2 — separates Cost drivers from Market drivers.
 *
 * Cost Stack  : base × inventory × distance  (operational reality)
 * Market Stack: neighbourhood × day × season × urgency  (price perception, capped)
 *
 * This module exports pure calculation helpers used by the API route
 * (src/app/api/quotes/generate/route.ts) and the admin quote preview.
 */

import {
  crewLoadedHourlyRate,
  estimateFuelCostWithDeadhead,
  estimateOperationalSuppliesCost,
  estimateTruckCostPerMove,
} from "./margin-cost-model";

// ═══════════════════════════════════════════════
// Config helpers (accepts both Map and Record)
// ═══════════════════════════════════════════════

type ConfigMap = Map<string, string> | Record<string, string>;

export function cfgNum(config: ConfigMap, key: string, fallback: number): number {
  const v = config instanceof Map ? config.get(key) : config[key];
  if (v === undefined || v === "" || Number.isNaN(Number(v))) return fallback;
  return Number(v);
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
  const freeZone = cfgNum(config, "deadhead_free_zone_km", cfgNum(config, "deadhead_free_km", 40));
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
  /** @deprecated Retained for call-site compatibility; margin cost uses operational supplies only. */
  tier: string;
  /** @deprecated Retained for call-site compatibility. */
  moveSize: string;
  /** When set, refines operational supplies estimate (same as quote generate). */
  inventoryItems?: { name?: string; quantity?: number; weight_score?: number; fragile?: boolean }[];
}

export function calcEstimatedCost(
  input: EstimatedCostInput,
  config: ConfigMap,
): EstimatedCost {
  const loaded = crewLoadedHourlyRate(config);
  const labour = Math.round(input.actualEstimatedHours * input.crew * loaded);
  const truck = estimateTruckCostPerMove(input.recommendedTruck, config);
  const fuel = estimateFuelCostWithDeadhead(input.distanceKm, input.recommendedTruck, config);
  const supplies = estimateOperationalSuppliesCost(input.inventoryItems ?? []);

  return { labour, truck, fuel, supplies, total: labour + truck + fuel + supplies };
}

export function calcEstimatedMarginPct(revenue: number, cost: EstimatedCost): number {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - cost.total) / revenue) * 100);
}

// ═══════════════════════════════════════════════
// Margin flag
// ═══════════════════════════════════════════════

export type MarginFlag = "green" | "yellow" | "orange" | "red";

/** Align thresholds with admin quote margin alerts (platform_config can override in warnings). */
export function getMarginFlag(marginPct: number): MarginFlag {
  if (marginPct < 15) return "red";
  if (marginPct < 25) return "orange";
  if (marginPct < 35) return "yellow";
  return "green";
}

// ═══════════════════════════════════════════════
// Margin warning (shown on admin quote preview)
// ═══════════════════════════════════════════════

export interface MarginWarning {
  level: "warning" | "critical" | "caution";
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
  const marginCaution = cfgNum(config, "margin_warning_threshold", 35);
  const marginLow = cfgNum(config, "margin_low_threshold", 25);
  const marginCritical = cfgNum(config, "margin_critical_threshold", 15);

  if (estimatedMargin >= marginCaution) return null;

  const level: "warning" | "critical" | "caution" =
    estimatedMargin < marginCritical ? "critical" : estimatedMargin < marginLow ? "warning" : "caution";
  const message =
    level === "critical"
      ? `Estimated margin ${estimatedMargin}% is unprofitable (threshold: ${marginCritical}%). Review pricing before sending.`
      : level === "warning"
        ? `Estimated margin ${estimatedMargin}% is low (below ${marginLow}%). Consider recommending a higher tier.`
        : `Estimated margin ${estimatedMargin}% is below target (${marginTarget}%). Acceptable for volume or strategic moves.`;

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
