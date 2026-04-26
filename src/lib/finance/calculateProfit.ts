/**
 * Profitability cost model — NOT revenue.
 * Moves:     labour + fuel (distance-based) + truck + supplies-by-size
 * Deliveries: labour + fuel + truck (supplies = $0)
 * Card processing fees are a client pass-through (added to what they pay), not Yugo operating cost, so they are
 * never subtracted from margin. When the client paid by card, we still show an estimated pass-through amount for reference.
 * Monthly business overhead is not allocated per job; see finance profitability page for company-wide overhead.
 */
export interface MoveCosts {
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  /** Estimated card processing pass-through (client-paid); 0 if not card. Never included in totalDirect. */
  processing: number;
  totalDirect: number;
  /** Kept for API shape; always 0 (no per-job overhead allocation). */
  allocatedOverhead: number;
  grossProfit: number;
  /** Same as gross profit (no per-job overhead). */
  netProfit: number;
  grossMargin: number;
  /** Same as gross margin. */
  netMargin: number;
}

function cfg(config: Record<string, string>, key: string, fallback = 0): number {
  return parseFloat(config[key] ?? "") || fallback;
}

/** True when final balance was paid by card, or balance unset and deposit was card. */
export function movePaysCardProcessingFee(move: {
  balance_method?: string | null;
  deposit_method?: string | null;
}): boolean {
  const bal = (move.balance_method || "").trim();
  if (bal.toLowerCase() === "card") return true;
  if (bal) return false;
  return (move.deposit_method || "").toLowerCase() === "card";
}

export function deliveryPaysCardProcessingFee(d: {
  payment_method?: string | null;
  balance_method?: string | null;
}): boolean {
  const p = (d.payment_method || "").trim();
  if (p.toLowerCase() === "card") return true;
  if (p) return false;
  return (d.balance_method || "").toLowerCase() === "card";
}

function paymentProcessingEstimate(revenue: number, config: Record<string, string>): number {
  return revenue * cfg(config, "payment_processing_pct", 0.029) + cfg(config, "payment_processing_flat", 0.3);
}

/**
 * Average packing supplies cost by move size (industry-based defaults).
 * These are used when platform_config doesn't have a specific supplies_cost_<size> entry.
 */
const SUPPLIES_DEFAULTS: Record<string, number> = {
  studio: 30,
  "1br": 50,
  "2br": 75,
  "3br": 110,
  "4br": 150,
  "5br_plus": 200,
  partial: 25,
  office: 70,
  single_item: 0,
};

function buildCosts(
  revenue: number,
  labour: number,
  fuel: number,
  truck: number,
  supplies: number,
  config: Record<string, string>,
  includeProcessingEstimate: boolean,
): MoveCosts {
  const processing = includeProcessingEstimate ? paymentProcessingEstimate(revenue, config) : 0;
  const totalDirect = labour + fuel + truck + supplies;
  const allocatedOverhead = 0;
  const grossProfit = revenue - totalDirect;
  const netProfit = grossProfit;
  const grossMargin = revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0;
  const netMargin = grossMargin;
  return {
    labour: Math.round(labour),
    fuel: Math.round(fuel * 100) / 100,
    truck,
    supplies,
    processing: Math.round(processing * 100) / 100,
    totalDirect: Math.round(totalDirect),
    allocatedOverhead: Math.round(allocatedOverhead),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    grossMargin,
    netMargin,
  };
}

export type ProfitabilitySpreadOpts = {
  /** Jobs (moves + deliveries) on the same scheduled calendar day sharing daily truck/insurance; min 1. */
  jobsOnSameDay?: number;
};

export function calculateMoveProfitability(
  move: {
    actual_hours?: number | null;
    est_hours?: number | null;
    actual_crew_count?: number | null;
    est_crew_size?: number | null;
    crew_count?: number | null;
    distance_km?: number | null;
    truck_primary?: string | null;
    truck_secondary?: string | null;
    move_size?: string | null;
    service_type?: string | null;
    estimate?: number | null;
    balance_method?: string | null;
    deposit_method?: string | null;
  },
  config: Record<string, string>,
  _monthlyMoveCountUnused: number,
  spreadOpts?: ProfitabilitySpreadOpts,
): MoveCosts {
  void _monthlyMoveCountUnused;
  const divisor = Math.max(1, spreadOpts?.jobsOnSameDay ?? 1);
  const revenue = Number(move.estimate ?? 0) || 0;
  const hours = Number(move.actual_hours ?? move.est_hours ?? 4) || 4;
  const crewSize = Number(move.actual_crew_count ?? move.est_crew_size ?? move.crew_count ?? 2) || 2;
  const labour = crewSize * hours * cfg(config, "crew_hourly_cost", 25);

  const distanceKm = Number(move.distance_km ?? 20) || 20;
  const fuel = distanceKm * 2 * cfg(config, "fuel_cost_per_km", 0.35);

  const workingDays = cfg(config, "truck_working_days_per_month", 22);
  const truckDailyRate = (type: string): number => {
    const explicit = parseFloat(config[`truck_daily_cost_${type}`] ?? "");
    if (explicit > 0) return explicit;
    const monthly = parseFloat(config[`truck_monthly_cost_${type}`] ?? "");
    if (monthly > 0) return Math.round((monthly / workingDays) * 100) / 100;
    const defaults: Record<string, number> = { sprinter: 65, "16ft": 70, "20ft": 80, "26ft": 295 };
    return defaults[type] ?? 75;
  };
  const truckType = (move.truck_primary ?? "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  const truckDailyCombined =
    truckDailyRate(truckType) +
    (move.truck_secondary ? truckDailyRate(move.truck_secondary.toLowerCase().replace(/[^a-z0-9]/g, "")) : 0);
  const insuranceDaily = cfg(config, "daily_truck_insurance_cad", 0);
  const truck = Math.round((truckDailyCombined + insuranceDaily) / divisor);

  const svc = (move.service_type ?? "local_move").toLowerCase();
  let suppliesKey: string;
  if (svc === "office_move" || svc === "office") suppliesKey = "supplies_cost_office";
  else if (svc === "single_item") suppliesKey = "supplies_cost_single_item";
  else suppliesKey = `supplies_cost_${(move.move_size ?? "studio").toLowerCase().replace(/[^a-z0-9_]/g, "")}`;

  const suppliesFallback = SUPPLIES_DEFAULTS[move.move_size?.toLowerCase() ?? "studio"] ?? 30;
  const supplies = cfg(config, suppliesKey, suppliesFallback);

  const includeProcessingEstimate = movePaysCardProcessingFee(move);
  return buildCosts(revenue, labour, fuel, truck, supplies, config, includeProcessingEstimate);
}

/**
 * Delivery profitability — supplies are always $0.
 * Distance from delivery.distance_km, zone-based fallback.
 */
export function calculateDeliveryProfitability(
  d: Record<string, unknown>,
  revenue: number,
  config: Record<string, string>,
  _monthlyMoveCountUnused: number,
  spreadOpts?: ProfitabilitySpreadOpts,
): MoveCosts {
  void _monthlyMoveCountUnused;
  const divisor = Math.max(1, spreadOpts?.jobsOnSameDay ?? 1);
  const isDayRate = String(d.booking_type || "").toLowerCase() === "day_rate";
  const defaultHours = isDayRate ? 8 : 4;
  const hours = Number(d.actual_hours ?? defaultHours) || defaultHours;
  const crewSize = Number(d.actual_crew_count ?? d.est_crew_size ?? 2) || 2;
  const labour = crewSize * hours * cfg(config, "crew_hourly_cost", 25);

  const zoneKm = d.zone != null ? (Number(d.zone) === 1 ? 15 : Number(d.zone) === 2 ? 35 : 50) : 20;
  const distanceKm = Number(d.distance_km ?? zoneKm) || zoneKm;
  const fuel = distanceKm * 2 * cfg(config, "fuel_cost_per_km", 0.35);

  const workingDays2 = cfg(config, "truck_working_days_per_month", 22);
  const delivTruckDaily = (type: string): number => {
    const explicit = parseFloat(config[`truck_daily_cost_${type}`] ?? "");
    if (explicit > 0) return explicit;
    const monthly = parseFloat(config[`truck_monthly_cost_${type}`] ?? "");
    if (monthly > 0) return Math.round((monthly / workingDays2) * 100) / 100;
    const defaults: Record<string, number> = { sprinter: 65, "16ft": 70, "20ft": 80, "26ft": 295 };
    return defaults[type] ?? 75;
  };
  const truckType = String(d.vehicle_type || "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  const insuranceDaily = cfg(config, "daily_truck_insurance_cad", 0);
  const truck = Math.round((delivTruckDaily(truckType) + insuranceDaily) / divisor);

  const supplies = 0;

  const includeProcessingEstimate = deliveryPaysCardProcessingFee({
    payment_method: d.payment_method as string | null | undefined,
    balance_method: d.balance_method as string | null | undefined,
  });
  return buildCosts(revenue, labour, fuel, truck, supplies, config, includeProcessingEstimate);
}

export function getMonthlyOverhead(config: Record<string, string>): number {
  const standard =
    cfg(config, "monthly_software_cost", 250) +
    cfg(config, "monthly_auto_insurance", 1000) +
    cfg(config, "monthly_gl_insurance", 300) +
    cfg(config, "monthly_marketing_budget", 1000) +
    cfg(config, "monthly_office_admin", 350) +
    cfg(config, "monthly_owner_draw", 0);

  let custom = 0;
  try {
    const items: { amount: number }[] = JSON.parse(config.custom_overhead_items ?? "[]");
    custom = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  } catch { /* invalid JSON, skip */ }

  return standard + custom;
}

export interface CustomOverheadItem {
  id: string;
  label: string;
  amount: number;
}
