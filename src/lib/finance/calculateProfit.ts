/**
 * Profitability cost model — NOT revenue.
 * Moves:     labour + fuel (distance-based) + truck + supplies-by-size
 * Deliveries: labour + fuel + truck (supplies = $0)
 * Card processing fees are a client pass-through (added to what they pay), not Yugo operating cost, so they are
 * never subtracted from margin. When the client paid by card, we still show an estimated pass-through amount for reference.
 * Monthly business overhead is not allocated per job; see finance profitability page for company-wide overhead.
 *
 * Labour cost: derived from per-role wages + payroll burden when the
 * `crew_hourly_cost` / `crew_loaded_hourly_rate` keys aren't explicitly
 * set. See src/lib/finance/payroll-burden.ts for the math (2026 Ontario
 * verified rates). This keeps per-job labour cost auditable rather than
 * an opaque $25/$28 magic number.
 */
import { getAverageCrewLoadedRate } from "./payroll-burden";
export interface MoveCosts {
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  /** Estimated card processing pass-through (client-paid); 0 if not card. Never included in totalDirect. */
  processing: number;
  totalDirect: number;
  /**
   * Per-job overhead share: dailyBurn ÷ jobsOnSameDay. Calculated by callers
   * that pass `dailyOverheadShare` in spread opts. Subtracted from grossProfit
   * to produce netProfit (= true contribution).
   */
  allocatedOverhead: number;
  /** Revenue × claims_reserve_pct. Subtracted from grossProfit alongside overhead. */
  claimsReserve: number;
  grossProfit: number;
  /** True contribution: grossProfit − allocatedOverhead − claimsReserve. */
  netProfit: number;
  grossMargin: number;
  /** True contribution as a % of revenue. */
  netMargin: number;
}

/**
 * Read a numeric config value, falling back ONLY when the key is
 * missing or unparseable. Treats explicit "0" as 0 (not a falsy
 * trigger that swaps in the fallback).
 *
 * The old `|| fallback` pattern silently overrode the operator's
 * explicit zero — when Marketing was saved as $0, the engine kept
 * computing as if Marketing = $1,000. This produced the YG-30286
 * overhead mismatch where the Monthly Overhead header read
 * $2,400/mo while the bottom-of-panel sum (which is computed in
 * React local state, where 0 stays 0) read $1,400. Same bug
 * inflated the MTD P&L card's "Monthly overhead" line by ~$1,000.
 */
function cfg(config: Record<string, string>, key: string, fallback = 0): number {
  const raw = config[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  /**
   * Per-row OH allocation: daily burn divided by same-day job count.
   * Drives true (post-overhead) profit columns on the profitability table.
   * 0 means no allocation — preserve legacy behaviour for callers that don't
   * pass it.
   */
  allocatedOverhead = 0,
): MoveCosts {
  const processing = includeProcessingEstimate ? paymentProcessingEstimate(revenue, config) : 0;
  const totalDirect = labour + fuel + truck + supplies;
  const claimsReserve = getClaimsReserveAmount(revenue, config);
  const grossProfit = revenue - totalDirect;
  // Net profit subtracts the per-row OH share + revenue-scaled claims reserve.
  // grossMargin keeps its meaning ("after direct costs"); netMargin is now the
  // true contribution number.
  const netProfit = grossProfit - allocatedOverhead - claimsReserve;
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
    claimsReserve: Math.round(claimsReserve * 100) / 100,
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    grossMargin,
    netMargin,
  };
}

export type ProfitabilitySpreadOpts = {
  /** Jobs (moves + deliveries) on the same scheduled calendar day sharing daily truck/insurance; min 1. */
  jobsOnSameDay?: number;
  /**
   * Daily overhead burn (monthly OH ÷ working days). If provided, divided by
   * jobsOnSameDay to compute the per-row OH share that gets subtracted into
   * netProfit. Pass 0 / omit to preserve gross-only view.
   */
  dailyOverheadBurn?: number;
};

export function calculateMoveProfitability(
  move: {
    actual_hours?: number | null;
    est_hours?: number | null;
    actual_crew_count?: number | null;
    est_crew_size?: number | null;
    crew_count?: number | null;
    estimated_duration_minutes?: number | null;
    distance_km?: number | null;
    truck_primary?: string | null;
    truck_secondary?: string | null;
    move_size?: string | null;
    service_type?: string | null;
    estimate?: number | null;
    balance_method?: string | null;
    deposit_method?: string | null;
    // Actual-cost snapshot persisted at completion (calcActualMargin). When
    // present these reflect the real tracked hours/crew and are the source of
    // truth — prefer them over re-deriving from defaults.
    actual_labour_cost?: number | null;
    actual_fuel_cost?: number | null;
    actual_truck_cost?: number | null;
    actual_supplies_cost?: number | null;
  },
  config: Record<string, string>,
  _monthlyMoveCountUnused: number,
  spreadOpts?: ProfitabilitySpreadOpts,
): MoveCosts {
  void _monthlyMoveCountUnused;
  const divisor = Math.max(1, spreadOpts?.jobsOnSameDay ?? 1);
  const revenue = Number(move.estimate ?? 0) || 0;
  // Hours fallback chain: real tracked/actual hours → quoted est_hours → the
  // per-move duration estimate (a single-item run is ~1h) → 4h only as a last
  // resort. The old blanket 4h default badly inflated labour on short jobs
  // (e.g. a 1.2h single-item move billed as 4h → $220 instead of ~$66).
  const durationHours =
    move.estimated_duration_minutes != null &&
    Number(move.estimated_duration_minutes) > 0
      ? Number(move.estimated_duration_minutes) / 60
      : null;
  const hours = Number(move.actual_hours ?? move.est_hours ?? durationHours ?? 4) || 4;
  const crewSize = Number(move.actual_crew_count ?? move.est_crew_size ?? move.crew_count ?? 2) || 2;
  // Loaded crew cost per mover-hour. Explicit `crew_hourly_cost` keeps
  // legacy behaviour; absent it, derive from wages + payroll burden.
  const explicitLoaded = cfg(config, "crew_hourly_cost", 0);
  const loadedPerMoverHour =
    explicitLoaded > 0 ? explicitLoaded : getAverageCrewLoadedRate(config);
  const derivedLabour = crewSize * hours * loadedPerMoverHour;

  const distanceKm = Number(move.distance_km ?? 20) || 20;
  const fuel = distanceKm * 2 * cfg(config, "fuel_cost_per_km", 0.35);

  const truckDailyRate = (type: string): number => {
    // Owned-vehicle exception (2026-06-11): when `truck_monthly_cost_<type>`
    // > 0, the truck is OWNED — its lease flows into Monthly Overhead, so
    // per-job direct cost is $0 to avoid double-counting. Sprinter
    // wear-and-tear is currently $0 by operator decision (we don't
    // charge for it).
    const monthly = parseFloat(config[`truck_monthly_cost_${type}`] ?? "");
    if (monthly > 0) return 0;
    // Rented trucks: bill the per-use day rate.
    const explicit = parseFloat(config[`truck_daily_cost_${type}`] ?? "");
    if (explicit > 0) return explicit;
    // Industry defaults — Toronto rental market 2026. Sprinter $0 (owned;
    // lease in OH). 16ft / 20ft bumped 2026-06-11; 24ft added 2026-06-28
    // after MV-30320 surfaced a stale $115 default falling through.
    const defaults: Record<string, number> = {
      sprinter: 0,
      "16ft": 100,
      "20ft": 150,
      "24ft": 200,
      "26ft": 295,
    };
    return defaults[type] ?? 100;
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
  // Same-day OH share. Truck above already divides by `divisor` — overhead
  // follows the same model: a day with N jobs spreads daily burn across all N.
  const ohShare =
    spreadOpts?.dailyOverheadBurn && spreadOpts.dailyOverheadBurn > 0
      ? spreadOpts.dailyOverheadBurn / divisor
      : 0;

  // Prefer the actual-cost snapshot recorded at completion: it reflects the
  // real tracked hours/crew, whereas the derivation above falls back to
  // defaults when actual_hours isn't persisted (it isn't a column on `moves`).
  // A recorded labour cost is the signal that a completion snapshot exists;
  // when it does, trust the whole snapshot (truck legitimately = $0 on owned
  // vehicles). No snapshot (move not completed) → keep the derived estimate.
  const hasActualSnapshot =
    move.actual_labour_cost != null && Number(move.actual_labour_cost) > 0;
  const labour = hasActualSnapshot
    ? Number(move.actual_labour_cost)
    : derivedLabour;
  const fuelFinal =
    hasActualSnapshot && move.actual_fuel_cost != null
      ? Number(move.actual_fuel_cost)
      : fuel;
  const truckFinal =
    hasActualSnapshot && move.actual_truck_cost != null
      ? Number(move.actual_truck_cost)
      : truck;
  const suppliesFinal =
    hasActualSnapshot && move.actual_supplies_cost != null
      ? Number(move.actual_supplies_cost)
      : supplies;

  return buildCosts(
    revenue,
    labour,
    fuelFinal,
    truckFinal,
    suppliesFinal,
    config,
    includeProcessingEstimate,
    ohShare,
  );
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
  // Loaded crew cost per mover-hour. Explicit `crew_hourly_cost` keeps
  // legacy behaviour; absent it, derive from wages + payroll burden.
  const explicitLoaded = cfg(config, "crew_hourly_cost", 0);
  const loadedPerMoverHour =
    explicitLoaded > 0 ? explicitLoaded : getAverageCrewLoadedRate(config);
  const labour = crewSize * hours * loadedPerMoverHour;

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
  const ohShareD =
    spreadOpts?.dailyOverheadBurn && spreadOpts.dailyOverheadBurn > 0
      ? spreadOpts.dailyOverheadBurn / divisor
      : 0;
  return buildCosts(
    revenue,
    labour,
    fuel,
    truck,
    supplies,
    config,
    includeProcessingEstimate,
    ohShareD,
  );
}

/**
 * Standard monthly overhead categories. Fleet costs are NOT included here —
 * truck cost recovery happens per-job via day rates (Model A: assets earn their
 * keep on jobs they run, not via spread allocation). See calculateMoveProfitability.
 *
 * The luxury-business expansion (WSIB, movers' liability, phone, bookkeeping,
 * vehicle maintenance) was added 2026-06-10 — previously these costs were either
 * undercounted or invisible in margin math. All default to 0 so existing
 * deployments don't see surprise overhead jumps; operator fills in real values
 * from current P&L.
 */
export function getMonthlyOverhead(config: Record<string, string>): number {
  // Fallback defaults are 0 across the board (changed 2026-06-11). The
  // engine should NOT assume $1,000 of marketing or $1,000 of auto
  // insurance just because a key is unset — that silently inflates
  // monthly overhead and depresses true margins on every quote.
  // Operator fills in real values from current P&L; an absent value
  // means "not tracked / not paid this month" = $0.
  const standard =
    cfg(config, "monthly_software_cost", 0) +
    cfg(config, "monthly_auto_insurance", 0) +
    cfg(config, "monthly_gl_insurance", 0) +
    cfg(config, "monthly_wsib", 0) +
    cfg(config, "monthly_movers_liability", 0) +
    cfg(config, "monthly_marketing_budget", 0) +
    cfg(config, "monthly_office_admin", 0) +
    cfg(config, "monthly_bookkeeping", 0) +
    cfg(config, "monthly_phone_internet", 0) +
    cfg(config, "monthly_vehicle_maintenance", 0) +
    cfg(config, "monthly_owner_draw", 0);

  let custom = 0;
  try {
    const items: { amount: number }[] = JSON.parse(config.custom_overhead_items ?? "[]");
    custom = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  } catch { /* invalid JSON, skip */ }

  // Owned-vehicle leases (2026-06-11). Any truck with a non-zero
  // `truck_monthly_cost_<type>` is an OWNED vehicle whose fixed monthly
  // cost belongs in overhead (you pay the lease whether or not the truck
  // runs that day). Rentals stay at $0 monthly and bill per-use.
  // Operator review: a Sprinter at $1,533/mo running only 7 days per
  // month was bleeding ~$1,100/mo of unrecovered fixed cost — invisible
  // until this change. See chat thread 2026-06-11.
  const ownedFleet =
    cfg(config, "truck_monthly_cost_sprinter", 0) +
    cfg(config, "truck_monthly_cost_16ft", 0) +
    cfg(config, "truck_monthly_cost_20ft", 0) +
    cfg(config, "truck_monthly_cost_24ft", 0) +
    cfg(config, "truck_monthly_cost_26ft", 0);

  return standard + custom + ownedFleet;
}

/**
 * Daily overhead burn — monthly overhead spread across working days. This is
 * the figure shown to operators at quote time and used to allocate per-job
 * OH share (split across same-day jobs at profitability view).
 *
 * Per-day was picked over per-move because moves aren't time-equal: a 3-day
 * Estate move consumes 3× the insurance/office/coordinator capacity of a
 * 1-day Essential — flat per-move flattens this and over-credits short jobs.
 */
export function getDailyOverheadBurn(config: Record<string, string>): number {
  const monthly = getMonthlyOverhead(config);
  const workingDays = cfg(config, "truck_working_days_per_month", 22);
  if (workingDays <= 0) return 0;
  return Math.round((monthly / workingDays) * 100) / 100;
}

/**
 * Claims reserve as a % of revenue — applied per job. Separate from monthly
 * OH because it scales with job size, not flat business burn. Default 0.5%
 * matches industry rule-of-thumb for damages/disputes.
 */
export function getClaimsReserveAmount(
  revenue: number,
  config: Record<string, string>,
): number {
  const pct = cfg(config, "overhead_claims_reserve_pct", 0.005);
  return Math.round(revenue * pct * 100) / 100;
}

export interface CustomOverheadItem {
  id: string;
  label: string;
  amount: number;
}
