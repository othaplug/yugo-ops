/**
 * Profitability cost model — NOT revenue.
 * Moves:     labour + fuel (distance-based) + truck + supplies-by-size + processing
 * Deliveries: labour + fuel (distance/zone-based) + truck + processing (supplies = $0)
 * Profit = billed amount − totalDirect
 */
export interface MoveCosts {
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  processing: number;
  totalDirect: number;
  allocatedOverhead: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

function cfg(config: Record<string, string>, key: string, fallback = 0): number {
  return parseFloat(config[key] ?? "") || fallback;
}

/**
 * Average packing supplies cost by move size (industry-based defaults).
 * These are used when platform_config doesn't have a specific supplies_cost_<size> entry.
 */
const SUPPLIES_DEFAULTS: Record<string, number> = {
  studio:    30,
  "1br":     50,
  "2br":     75,
  "3br":    110,
  "4br":    150,
  "5br_plus": 200,
  partial:   25,
  office:    70,
  single_item: 0,
};

function allocateOverhead(config: Record<string, string>, monthlyMoveCount: number): number {
  const monthly =
    cfg(config, "monthly_software_cost", 250) +
    cfg(config, "monthly_auto_insurance", 1000) +
    cfg(config, "monthly_gl_insurance", 300) +
    cfg(config, "monthly_marketing_budget", 1000) +
    cfg(config, "monthly_office_admin", 350) +
    cfg(config, "monthly_owner_draw", 0);
  return monthlyMoveCount > 0 ? monthly / monthlyMoveCount : monthly;
}

function buildCosts(
  revenue: number,
  labour: number,
  fuel: number,
  truck: number,
  supplies: number,
  config: Record<string, string>,
  monthlyMoveCount: number,
  paymentMethod?: string | null,
): MoveCosts {
  // Processing costs are absorbed into quoted prices via processing_recovery_rate/flat.
  // For margin accounting purposes we still model it as a cost against revenue.
  // paymentMethod param retained for API compatibility but no longer affects this calc.
  void paymentMethod;
  const processing = revenue * cfg(config, "payment_processing_pct", 0.029) + cfg(config, "payment_processing_flat", 0.3);
  const totalDirect = labour + fuel + truck + supplies + processing;
  const allocatedOverhead = allocateOverhead(config, monthlyMoveCount);
  const grossProfit = revenue - totalDirect;
  const netProfit = grossProfit - allocatedOverhead;
  const grossMargin = revenue > 0 ? Math.round(((grossProfit / revenue) * 100) * 10) / 10 : 0;
  const netMargin = revenue > 0 ? Math.round(((netProfit / revenue) * 100) * 10) / 10 : 0;
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
  monthlyMoveCount: number,
): MoveCosts {
  const revenue = Number(move.estimate ?? 0) || 0;
  const hours = Number(move.actual_hours ?? move.est_hours ?? 4) || 4;
  const crewSize = Number(move.actual_crew_count ?? move.est_crew_size ?? move.crew_count ?? 2) || 2;
  const labour = crewSize * hours * cfg(config, "crew_hourly_cost", 25);

  const distanceKm = Number(move.distance_km ?? 20) || 20;
  // Round-trip fuel (pickup + dropoff)
  const fuel = distanceKm * 2 * cfg(config, "fuel_cost_per_km", 0.35);

  const workingDays = cfg(config, "truck_working_days_per_month", 22);
  const truckDailyRate = (type: string): number => {
    const explicit = parseFloat(config[`truck_daily_cost_${type}`] ?? "");
    if (explicit > 0) return explicit;
    const monthly = parseFloat(config[`truck_monthly_cost_${type}`] ?? "");
    if (monthly > 0) return Math.round((monthly / workingDays) * 100) / 100;
    // Industry-researched fallbacks (Canadian market, pre-HST)
    const defaults: Record<string, number> = { sprinter: 65, "16ft": 70, "20ft": 80, "26ft": 295 };
    return defaults[type] ?? 75;
  };
  const truckType = (move.truck_primary ?? "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  const truck = truckDailyRate(truckType) +
    (move.truck_secondary ? truckDailyRate(move.truck_secondary.toLowerCase().replace(/[^a-z0-9]/g, "")) : 0);

  // Supplies: look up by move size, fall back to industry defaults (0 for office/single_item overrides)
  const svc = (move.service_type ?? "local_move").toLowerCase();
  let suppliesKey: string;
  if (svc === "office_move" || svc === "office") suppliesKey = "supplies_cost_office";
  else if (svc === "single_item") suppliesKey = "supplies_cost_single_item";
  else suppliesKey = `supplies_cost_${(move.move_size ?? "studio").toLowerCase().replace(/[^a-z0-9_]/g, "")}`;

  const suppliesFallback = SUPPLIES_DEFAULTS[move.move_size?.toLowerCase() ?? "studio"] ?? 30;
  const supplies = cfg(config, suppliesKey, suppliesFallback);

  const paymentMethod = move.balance_method ?? move.deposit_method ?? null;
  return buildCosts(revenue, labour, fuel, truck, supplies, config, monthlyMoveCount, paymentMethod);
}

/**
 * Delivery profitability — supplies are always $0.
 * Distance from delivery.distance_km, zone-based fallback.
 */
export function calculateDeliveryProfitability(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: Record<string, any>,
  revenue: number,
  config: Record<string, string>,
  monthlyMoveCount: number,
): MoveCosts {
  const isDayRate = (d.booking_type || "").toLowerCase() === "day_rate";
  const defaultHours = isDayRate ? 8 : 4;
  const hours = Number(d.actual_hours ?? defaultHours) || defaultHours;
  const crewSize = Number(d.actual_crew_count ?? d.est_crew_size ?? 2) || 2;
  const labour = crewSize * hours * cfg(config, "crew_hourly_cost", 25);

  // Use stored distance_km, fall back to zone estimate
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
  const truckType = (d.vehicle_type || "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  const truck = delivTruckDaily(truckType);

  // Deliveries do not use packing supplies
  const supplies = 0;

  // Delivery payment method
  const paymentMethod = (d.payment_method ?? d.balance_method ?? null) as string | null;
  return buildCosts(revenue, labour, fuel, truck, supplies, config, monthlyMoveCount, paymentMethod);
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
