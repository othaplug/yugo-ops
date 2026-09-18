/**
 * Office (commercial) building access model — the commercial parallel to the
 * residential deriveAccessModel(). An office move is building-to-building, so
 * access is captured for TWO sites (origin + destination), each carrying the
 * commercial drivers that actually cost crew time: elevator topology, floor,
 * loading position, dock-to-suite carry, multi-level suites, after-hours
 * building rules, and COI.
 *
 * Access is TIER-AGNOSTIC. The same crew carries the same furniture through the
 * same freight elevator whether the client bought Essential, Signature, or
 * Priority — so the model returns ONE surcharge that lifts all three tiers
 * equally (fed into the engine's existing accessSurcharge), never a tier lever.
 *
 * PRICING: each driver adds crew-minutes to every loading/unloading cycle.
 *     surcharge = (originPerCycleMin + destPerCycleMin)
 *               × loadingCycles(itemCount)
 *               / 60 × moveRate
 * A "cycle" is one load/unload pass — roughly one elevator trip carrying a
 * batch of items — so cycles scale with the inventory item count, not the
 * relative volume score. The minute anchors and the items→cycles divisor below
 * are Phase 2 defaults; Phase 3 calibrates them against real office jobs (tune
 * the ACCESS_* tables + accessItemsPerCycle).
 */

export type OfficeElevator = "freight" | "passenger" | "none";
export type OfficeFloorBand = "ground" | "low" | "mid" | "high" | "tower";
export type OfficeLoading = "dock" | "street" | "underground";
export type OfficeCarry = "short" | "medium" | "long" | "very_long";

/** Per-building access inputs, captured on the office form for each site. */
export interface OfficeSiteAccess {
  /** Which floor the suite sits on (bands, not exact floor). */
  floorBand?: OfficeFloorBand;
  /** Elevator available to the crew. */
  elevator?: OfficeElevator;
  /** Freight/elevator booking window required (minutes reserved), if any. */
  elevatorWindowMin?: number | null;
  /** Where the truck loads. */
  loading?: OfficeLoading;
  /** Carry distance dock/truck → elevator → suite. */
  carry?: OfficeCarry;
  /** Suite spans more than one internal level (mezzanine). */
  multiLevel?: boolean;
  /** Building rule forces an evening/overnight move (not an operator choice). */
  afterHoursRequired?: boolean;
  /** Property management requires a Certificate of Insurance. */
  coiRequired?: boolean;
}

export interface OfficeAccessConfig {
  /** Crew rate used to price access crew-hours (matches the engine move rate). */
  moveRate?: number;
  /** Inventory items carried per load/unload cycle (one elevator trip's batch). */
  accessItemsPerCycle?: number;
  /** Floor on the number of cycles a job is assumed to run. */
  accessMinCycles?: number;
  /** Ceiling on cycles so a huge inventory can't run the surcharge away. */
  accessMaxCycles?: number;
}

const ACCESS_DEFAULTS: Required<OfficeAccessConfig> = {
  moveRate: 53.4,
  accessItemsPerCycle: 5,
  accessMinCycles: 4,
  accessMaxCycles: 50,
};

// ── Minute anchors (crew-minutes added per load/unload cycle) ──
// Elevator base mirrors the residential access model (freight 2.5, passenger 4,
// none 6); passenger-only is bumped a touch for commercial (small cars, security
// escorts, one load at a time). Phase 3 calibrates.
const ELEVATOR_MIN: Record<OfficeElevator, number> = {
  freight: 2.5,
  passenger: 5,
  none: 6,
};
// High-floor transit, on top of the elevator base.
const FLOOR_TRANSIT_MIN: Record<OfficeFloorBand, number> = {
  ground: 0,
  low: 0,
  mid: 1,
  high: 2,
  tower: 3,
};
const LOADING_MIN: Record<OfficeLoading, number> = {
  dock: 0,
  street: 1.5,
  underground: 2,
};
const CARRY_MIN: Record<OfficeCarry, number> = {
  short: 0,
  medium: 1.5,
  long: 3,
  very_long: 5,
};
const MULTI_LEVEL_MIN = 2;

export type OfficeAccessDriver = {
  key: string;
  label: string;
  site: "origin" | "destination";
  minutesPerCycle: number;
};

export type OfficeAccessFlag = { key: string; label: string };

export type OfficeAccessSiteBreakdown = {
  perCycleMinutes: number;
  drivers: OfficeAccessDriver[];
};

export type OfficeAccessModel = {
  /** Whether any typed access fields were supplied (else this is a no-op). */
  present: boolean;
  origin: OfficeAccessSiteBreakdown;
  destination: OfficeAccessSiteBreakdown;
  drivers: OfficeAccessDriver[];
  perCycleMinutes: number;
  loadingCycles: number;
  accessCrewMinutes: number;
  /** Pre-tax dollar surcharge added equally to every tier. */
  surcharge: number;
  complexityRating: number;
  schedulingFlags: OfficeAccessFlag[];
  recommendExtraCrew: boolean;
  /** True when a building rule forces after-hours (feeds the engine multiplier). */
  afterHoursRequired: boolean;
};

const clean = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** True when a site carries at least one meaningful access field. */
function siteHasFields(site: OfficeSiteAccess | undefined | null): site is OfficeSiteAccess {
  if (!site) return false;
  return (
    (site.floorBand != null && site.floorBand !== "ground") ||
    (site.elevator != null && site.elevator !== "freight") ||
    (site.loading != null && site.loading !== "dock") ||
    (site.carry != null && site.carry !== "short") ||
    site.multiLevel === true ||
    site.afterHoursRequired === true ||
    site.coiRequired === true ||
    clean(site.elevatorWindowMin) != null
  );
}

function complexityFromMinutes(m: number): number {
  if (m <= 1) return 1;
  if (m <= 5) return 2;
  if (m <= 9) return 3;
  if (m <= 14) return 4;
  return 5;
}

function deriveSite(
  site: OfficeSiteAccess | undefined | null,
  where: "origin" | "destination",
): OfficeAccessSiteBreakdown {
  const drivers: OfficeAccessDriver[] = [];
  if (!site) return { perCycleMinutes: 0, drivers };

  const add = (key: string, label: string, minutesPerCycle: number) => {
    if (minutesPerCycle > 0.01) {
      drivers.push({
        key,
        label,
        site: where,
        minutesPerCycle: Math.round(minutesPerCycle * 10) / 10,
      });
    }
  };

  const elevator = site.elevator ?? "freight";
  const floorBand = site.floorBand ?? "ground";
  const loading = site.loading ?? "dock";
  const carry = site.carry ?? "short";

  const elevatorLabel =
    elevator === "freight"
      ? "Freight elevator"
      : elevator === "passenger"
        ? "Passenger-only elevator"
        : "No elevator (stairs)";
  add("elevator", elevatorLabel, ELEVATOR_MIN[elevator]);
  add("floor_transit", "High-floor transit", FLOOR_TRANSIT_MIN[floorBand]);
  add(
    "loading",
    loading === "street" ? "Street / curb load" : loading === "underground" ? "Underground load" : "Dock load",
    LOADING_MIN[loading],
  );
  add(
    "carry",
    "Carry: dock → elevator → suite",
    CARRY_MIN[carry],
  );
  if (site.multiLevel) add("multi_level", "Multi-level suite", MULTI_LEVEL_MIN);

  const perCycleMinutes =
    Math.round(drivers.reduce((s, d) => s + d.minutesPerCycle, 0) * 10) / 10;
  return { perCycleMinutes, drivers };
}

function siteFlags(
  site: OfficeSiteAccess | undefined | null,
  where: "origin" | "destination",
): OfficeAccessFlag[] {
  const flags: OfficeAccessFlag[] = [];
  if (!site) return flags;
  const label = where === "origin" ? "origin" : "destination";
  const win = clean(site.elevatorWindowMin);
  if (win != null && win > 0) {
    flags.push({
      key: `elevator_window_${where}`,
      label: `Reserve a ${Math.round(win)}-min elevator window at the ${label}`,
    });
  }
  if (site.coiRequired) {
    flags.push({ key: `coi_${where}`, label: `Send COI to ${label} property management` });
  }
  return flags;
}

export function deriveOfficeAccessModel(
  originIn: OfficeSiteAccess | undefined | null,
  destIn: OfficeSiteAccess | undefined | null,
  itemCount: number,
  config: OfficeAccessConfig = {},
): OfficeAccessModel {
  const c = { ...ACCESS_DEFAULTS, ...config };
  const present = siteHasFields(originIn) || siteHasFields(destIn);

  const origin = deriveSite(originIn, "origin");
  const destination = deriveSite(destIn, "destination");
  const drivers = [...origin.drivers, ...destination.drivers];
  const perCycleMinutes =
    Math.round((origin.perCycleMinutes + destination.perCycleMinutes) * 10) / 10;

  const loadingCycles = Math.min(
    c.accessMaxCycles,
    Math.max(c.accessMinCycles, Math.round(Math.max(0, itemCount) / c.accessItemsPerCycle)),
  );
  const accessCrewMinutes = Math.round(perCycleMinutes * loadingCycles);
  const surcharge = present
    ? Math.round((accessCrewMinutes / 60) * c.moveRate)
    : 0;

  const afterHoursRequired =
    originIn?.afterHoursRequired === true || destIn?.afterHoursRequired === true;

  const schedulingFlags: OfficeAccessFlag[] = [
    ...siteFlags(originIn, "origin"),
    ...siteFlags(destIn, "destination"),
  ];
  if (afterHoursRequired) {
    schedulingFlags.push({
      key: "after_hours_building",
      label: "After-hours building access required: book the freight/security window",
    });
  }

  const complexityRating = complexityFromMinutes(perCycleMinutes);
  if (complexityRating >= 4) {
    schedulingFlags.push({ key: "site_check", label: "Pre-move site check recommended" });
  }
  const recommendExtraCrew = perCycleMinutes >= 12;

  return {
    present,
    origin,
    destination,
    drivers,
    perCycleMinutes,
    loadingCycles,
    accessCrewMinutes,
    surcharge,
    complexityRating,
    schedulingFlags,
    recommendExtraCrew,
    afterHoursRequired,
  };
}
