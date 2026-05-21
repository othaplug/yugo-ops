/**
 * Three-leg fuel cost for the margin estimate.
 *
 * Every job actually has three driving segments:
 *
 *   Leg 1: Office → Pickup            (deadhead out, empty truck)
 *   Leg 2: Pickup → Dropoff           (job route, loaded truck)
 *   Leg 3: Dropoff → Office           (deadhead return, empty truck)
 *
 * The previous estimator (estimateFuelCostWithDeadhead in margin-cost-model.ts)
 * added a flat `avg_deadhead_km` of 15 km to the loaded distance and called
 * it a day. That's fine in-city but undercounts obvious cases — a Stouffville
 * job with 55 km deadhead each way got 11.7 km of fuel priced when the actual
 * cost was ~110 km of empty driving plus the loaded route. On longer
 * out-of-town jobs (Kingston, London) the under-count compounds.
 *
 * Loaded legs use the truck's published per-km cost; empty legs apply a
 * configurable multiplier (default 73%) reflecting reduced fuel burn when
 * the truck isn't loaded. Both rates live in platform_config.
 *
 * Deadhead distance is computed via haversine from the configured base
 * office coordinates. We deliberately don't call Mapbox for the deadhead
 * legs — straight-line is close enough for cost estimation and avoids
 * hitting an external API on every quote.
 */

// PricingConfig matches margin-cost-model.ts's local type. Inlined here
// to avoid a circular import or cross-package re-export.
type PricingConfig = Map<string, string> | Record<string, string>;

function cfgNum(config: PricingConfig, key: string, fallback: number): number {
  const v =
    config instanceof Map
      ? config.get(key)
      : (config as Record<string, string>)[key];
  if (v === undefined || v === "" || Number.isNaN(Number(v))) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export type TruckTypeForFuel =
  | "sprinter"
  | "16ft"
  | "20ft"
  | "24ft"
  | "26ft"
  | "none";

export type ThreeLegFuelBreakdown = {
  total: number;
  deadheadOutKm: number;
  deadheadOutCost: number;
  jobRouteKm: number;
  jobRouteCost: number;
  deadheadReturnKm: number;
  deadheadReturnCost: number;
  /** True when the deadhead legs are real (we had coords); false when we
   *  fell back to the multiplier estimate because coords weren't available. */
  precise: boolean;
};

const TRUCK_CFG_KEY: Record<TruckTypeForFuel, string> = {
  sprinter: "fuel_rate_sprinter_per_km",
  "16ft": "fuel_rate_16ft_per_km",
  "20ft": "fuel_rate_20ft_per_km",
  "24ft": "fuel_rate_24ft_per_km",
  "26ft": "fuel_rate_26ft_per_km",
  none: "fuel_rate_sprinter_per_km",
};

const TRUCK_DEFAULTS: Record<TruckTypeForFuel, number> = {
  sprinter: 0.18,
  "16ft": 0.32,
  "20ft": 0.42,
  "24ft": 0.48,
  "26ft": 0.52,
  none: 0.18,
};

function normalizeTruck(t: string | null | undefined): TruckTypeForFuel {
  const k = (t || "16ft").toLowerCase().replace(/\s+/g, "");
  if (k === "sprinter" || k === "16ft" || k === "20ft" || k === "24ft" || k === "26ft" || k === "none") {
    return k;
  }
  return "16ft";
}

function loadedRatePerKm(truck: TruckTypeForFuel, config: PricingConfig): number {
  return cfgNum(config, TRUCK_CFG_KEY[truck], TRUCK_DEFAULTS[truck]);
}

function emptyRatePerKm(truck: TruckTypeForFuel, config: PricingConfig): number {
  const loaded = loadedRatePerKm(truck, config);
  const mult = cfgNum(config, "fuel_rate_empty_multiplier", 0.73);
  return loaded * (Number.isFinite(mult) && mult > 0 ? mult : 0.73);
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return 0;
  }
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcThreeLegFuelCost(input: {
  pickupLat: number | null | undefined;
  pickupLng: number | null | undefined;
  dropoffLat: number | null | undefined;
  dropoffLng: number | null | undefined;
  /** Mapbox-derived loaded-leg distance in km. */
  jobRouteKm: number;
  truckType: string | null | undefined;
  config: PricingConfig;
}): ThreeLegFuelBreakdown {
  const truck = normalizeTruck(input.truckType);
  const loadedRate = loadedRatePerKm(truck, input.config);
  const emptyRate = emptyRatePerKm(truck, input.config);

  const baseLat = cfgNum(input.config, "base_office_lat", 43.6543);
  const baseLng = cfgNum(input.config, "base_office_lng", -79.3577);

  const haveCoords =
    Number.isFinite(input.pickupLat) &&
    Number.isFinite(input.pickupLng) &&
    Number.isFinite(input.dropoffLat) &&
    Number.isFinite(input.dropoffLng);

  let deadheadOutKm: number;
  let deadheadReturnKm: number;
  let precise: boolean;

  if (haveCoords) {
    deadheadOutKm = haversineKm(
      baseLat,
      baseLng,
      Number(input.pickupLat),
      Number(input.pickupLng),
    );
    deadheadReturnKm = haversineKm(
      Number(input.dropoffLat),
      Number(input.dropoffLng),
      baseLat,
      baseLng,
    );
    precise = true;
  } else {
    // Fallback: when coords aren't available we approximate the deadhead
    // as 1.5× the job route distance (rough heuristic — closer to truth
    // than the old flat 15km when out-of-town, no worse in-town).
    const fallback = Math.max(0, input.jobRouteKm) * 1.5;
    deadheadOutKm = fallback / 2;
    deadheadReturnKm = fallback / 2;
    precise = false;
  }

  const jobRouteKm = Math.max(0, input.jobRouteKm);
  const deadheadOutCost = Math.round(deadheadOutKm * emptyRate);
  const jobRouteCost = Math.round(jobRouteKm * loadedRate);
  const deadheadReturnCost = Math.round(deadheadReturnKm * emptyRate);

  return {
    total: deadheadOutCost + jobRouteCost + deadheadReturnCost,
    deadheadOutKm: Math.round(deadheadOutKm),
    deadheadOutCost,
    jobRouteKm,
    jobRouteCost,
    deadheadReturnKm: Math.round(deadheadReturnKm),
    deadheadReturnCost,
    precise,
  };
}
