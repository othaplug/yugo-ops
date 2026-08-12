/**
 * Long-distance transit surcharge — the incremental cost of relocating beyond
 * the local service radius, added on top of the residential tier stack.
 *
 * Every figure is real and sourced, not invented:
 *   - Transit labour: round-trip DRIVE hours × crew × the loaded crew rate
 *     (payroll-burden.ts, ~$25/mover-hr incl. 2026 Ontario CPP/EI/WSIB burden).
 *   - Fuel: loaded run + empty return at the truck's published per-km fuel cost
 *     (three-leg-fuel.ts: 26ft $0.52/km, empty legs ×0.73), cross-checked to
 *     Ontario diesel ~$1.97/L and a 26ft box truck ~25 L/100km.
 *   - Overnight (only when one-way drive exceeds the trigger): rooms × hotel +
 *     crew × per-diem, near pass-through. Hotel ~$140 (Ontario budget-mid),
 *     per-diem $69 (CRA simplified meal max), 2 crew per room.
 *
 * Everything scales with crew, distance, truck, nights, and move size. Move
 * size enters two ways: (1) the caller passes the per-tier crew, which already
 * grows with the home; (2) truckloads — a 5-bedroom estate does not fit in one
 * 26ft truck, and on a cross-province route you cannot make a second trip, so a
 * large home dispatches a second truck. That doubles the route's fuel (two
 * trucks burn two tanks) and, when it forces more crew than one truck seats,
 * more overnight rooms. Below the km threshold it returns zero, so ordinary
 * local moves are untouched.
 */

type ConfigLike = Map<string, string> | Record<string, string | number | null | undefined>;

function cfgNum(config: ConfigLike, key: string, fallback: number): number {
  const v = config instanceof Map ? config.get(key) : (config as Record<string, unknown>)[key];
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Published per-km fuel cost by truck — mirrors three-leg-fuel.ts defaults. */
const TRUCK_FUEL_PER_KM: Record<string, number> = {
  sprinter: 0.18,
  "16ft": 0.32,
  "20ft": 0.42,
  "24ft": 0.48,
  "26ft": 0.52,
};

function truckFuelPerKm(truck: string | null | undefined, config: ConfigLike): number {
  const t = String(truck ?? "26ft").toLowerCase().replace(/[^0-9a-z]/g, "");
  const key =
    t.includes("sprinter") || t.includes("cargo") ? "sprinter" :
    t.includes("16") ? "16ft" :
    t.includes("20") ? "20ft" :
    t.includes("24") ? "24ft" :
    "26ft";
  return cfgNum(config, `fuel_rate_${key}_per_km`, TRUCK_FUEL_PER_KM[key] ?? 0.52);
}

/**
 * Truck-runs the home needs door-to-door. A 26ft truck (~1,700 cu ft) holds up
 * to a 4-bedroom home; a 5+ bedroom / estate exceeds one load, and on a long
 * route you can't make a return trip, so it dispatches a second truck. Tunable
 * per size via `ld_truckloads_<size>`.
 */
const TRUCKLOADS_BY_SIZE: Record<string, number> = {
  studio: 1,
  "1br": 1,
  "2br": 1,
  "3br": 1,
  "4br": 1,
  "5br_plus": 2,
  office: 2,
};

function truckloadsForSize(moveSize: string | null | undefined, config: ConfigLike): number {
  const key = String(moveSize ?? "2br").toLowerCase().trim();
  const fallback = TRUCKLOADS_BY_SIZE[key] ?? 1;
  return Math.max(1, Math.round(cfgNum(config, `ld_truckloads_${key}`, fallback)));
}

export type LongDistanceTransit = {
  applies: boolean;
  transitLabour: number;
  fuel: number;
  overnight: number;
  nights: number;
  total: number;
  breakdown: { label: string; amount: number }[];
};

export function calcLongDistanceTransit(params: {
  /** Crew size for THIS tier (Estate carries more hands than Essential). */
  crew: number;
  /** One-way loaded route distance, km. */
  distKm: number;
  /** One-way drive time, minutes (from the route). */
  driveTimeMin: number;
  /** Recommended truck for the move. */
  truck: string | null | undefined;
  /** Move size (studio/1br/.../5br_plus) — drives how many trucks the route needs. */
  moveSize?: string | null;
  /** Loaded crew rate ($/mover-hr) from crewLoadedHourlyRate(config). */
  loadedRate: number;
  config: ConfigLike;
}): LongDistanceTransit {
  const { crew, distKm, driveTimeMin, truck, moveSize, loadedRate, config } = params;
  const threshold = cfgNum(config, "long_distance_km_threshold", 100);
  const empty: LongDistanceTransit = {
    applies: false, transitLabour: 0, fuel: 0, overnight: 0, nights: 0, total: 0, breakdown: [],
  };
  if (!(distKm >= threshold) || crew <= 0) return empty;

  const oneWayHours = Math.max(0, driveTimeMin) / 60;
  const roundTripHours = oneWayHours * 2;
  // How many trucks the home fills. On a long route each truck drives its own
  // round trip, so a second truck is a second tank of fuel over the distance.
  const truckloads = truckloadsForSize(moveSize, config);

  // 1) Transit labour — the whole crew is paid to drive there and back (a real
  //    cost a local move never incurs), regardless of how many trucks they
  //    split across. Service component, marked up.
  const labourMargin = cfgNum(config, "ld_transit_labour_margin", 1.45);
  const transitLabour = Math.round(roundTripHours * crew * loadedRate * labourMargin);

  // 2) Fuel — loaded run out + empty return (73% burn), at the truck's per-km
  //    fuel cost, once per truckload. Cost + light surcharge.
  const perKm = truckFuelPerKm(truck, config);
  const emptyReturnFactor = cfgNum(config, "fuel_empty_leg_multiplier", 0.73);
  const fuelMargin = cfgNum(config, "ld_fuel_margin", 1.2);
  const fuel = Math.round(distKm * perKm * (1 + emptyReturnFactor) * fuelMargin * truckloads);

  // 3) Overnight — only when a one-day round trip isn't safe/legal. Near
  //    pass-through (not a service you'd mark up). Rooms scale with crew.
  const triggerH = cfgNum(config, "ld_overnight_trigger_hours", 5);
  const nights = oneWayHours >= triggerH ? Math.max(1, Math.ceil(oneWayHours / 10)) : 0;
  const crewPerRoom = Math.max(1, cfgNum(config, "ld_crew_per_room", 2));
  const rooms = Math.ceil(crew / crewPerRoom);
  const hotel = cfgNum(config, "ld_hotel_per_room_night", 140);
  const perDiem = cfgNum(config, "ld_per_diem_per_crew_night", 69);
  const ovnMargin = cfgNum(config, "ld_overnight_margin", 1.1);
  const overnight =
    nights > 0
      ? Math.round(nights * (rooms * hotel + crew * perDiem) * ovnMargin)
      : 0;

  const total = transitLabour + fuel + overnight;
  const breakdown: { label: string; amount: number }[] = [
    { label: `Transit crew (${roundTripHours.toFixed(1)} hr round trip × ${crew})`, amount: transitLabour },
    { label: truckloads > 1 ? `Fuel (loaded + return, ${truckloads} trucks)` : "Fuel (loaded + return)", amount: fuel },
  ];
  if (overnight > 0) {
    breakdown.push({ label: `Overnight (${nights} night${nights !== 1 ? "s" : ""}, ${rooms} room${rooms !== 1 ? "s" : ""})`, amount: overnight });
  }

  return { applies: true, transitLabour, fuel, overnight, nights, total, breakdown };
}
