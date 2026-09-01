/**
 * Per-address Access Profile — the type-aware capture model for a quote's
 * FROM/TO addresses. This is the ad-hoc-quote counterpart to a saved
 * building_profiles row: it captures the same typed dimensions the building
 * model already understands, so a single derivation (deriveAccessModel) prices
 * both paths.
 *
 * Ship 1 is capture + persist only. `profileToAccessRow` feeds the existing
 * deriveAccessModel for the live operator readout; `profileToLegacyAccess`
 * maps a captured profile back to the legacy access/parking enum so pricing is
 * unchanged while the richer model is dark behind a flag.
 */

import { deriveAccessModel, type AccessModel } from "./access-model";

/** Platform-config as a Map or plain object (both call shapes). */
type ConfigLike =
  | Map<string, string>
  | Record<string, string | number | null | undefined>;

function cfgGet(config: ConfigLike, key: string): string | undefined {
  const v = config instanceof Map ? config.get(key) : config[key];
  return v === undefined || v === null ? undefined : String(v);
}

export type AccessPropertyType = "house" | "town" | "condo" | "walkup" | "ground";

export type EntranceStepsBand = "none" | "few" | "porch" | "many";
export type TruckSpot = "driveway" | "street" | "laneway" | "far";
export type StaircaseType = "open" | "narrow" | "tight_turn" | "spiral";
export type StairRunType = "straight" | "switchback" | "exterior" | "spiral";
export type StairWidthBand = "roomy" | "standard" | "tight";
export type ElevatorType = "passenger" | "freight" | "both" | "none";
export type CarryBand = "short" | "medium" | "long" | "very_long";

export type AccessProfile = {
  property_type: AccessPropertyType;
  // house / townhouse
  interior_levels?: number;
  finished_basement?: boolean;
  staircase_type?: StaircaseType;
  // walk-up
  unit_floor?: number;
  stair_type?: StairRunType;
  stair_width_band?: StairWidthBand;
  // condo / elevator
  elevator_type?: ElevatorType;
  reserved_window?: boolean;
  coi_required?: boolean;
  carry_band?: CarryBand;
  // shared
  entrance_steps_band?: EntranceStepsBand;
  truck_spot?: TruckSpot;
};

/** One selectable field in the progressive-disclosure form. */
export type AccessFieldSpec = {
  key: keyof AccessProfile;
  label: string;
  /** [storedValue, humanLabel] */
  options: [string, string][];
  /** Values stored as numbers rather than strings. */
  numeric?: boolean;
  /** Values stored as booleans ("1"/"0"). */
  boolean?: boolean;
  default: string;
};

export type AccessTypeSpec = {
  key: AccessPropertyType;
  label: string;
  archetype: "house" | "walk_up" | "elevator";
  fields: AccessFieldSpec[];
};

export const ACCESS_TYPE_SPECS: AccessTypeSpec[] = [
  {
    key: "house",
    label: "Detached / Semi",
    archetype: "house",
    fields: [
      { key: "interior_levels", label: "Interior storeys", numeric: true, default: "2", options: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4+"]] },
      { key: "finished_basement", label: "Finished basement with contents?", boolean: true, default: "0", options: [["0", "No"], ["1", "Yes"]] },
      { key: "staircase_type", label: "Staircase shape", default: "open", options: [["open", "Open"], ["narrow", "Narrow"], ["tight_turn", "Tight turn"], ["spiral", "Spiral"]] },
      { key: "entrance_steps_band", label: "Steps to front door", default: "few", options: [["none", "None"], ["few", "A few"], ["porch", "Porch"], ["many", "Many"]] },
      { key: "truck_spot", label: "Truck can park", default: "driveway", options: [["driveway", "Driveway"], ["street", "Street"], ["laneway", "Laneway"], ["far", "Far off"]] },
    ],
  },
  {
    key: "town",
    label: "Freehold townhouse",
    archetype: "house",
    fields: [
      { key: "interior_levels", label: "Interior levels", numeric: true, default: "3", options: [["2", "2"], ["3", "3"], ["4", "4"]] },
      { key: "finished_basement", label: "Finished basement with contents?", boolean: true, default: "1", options: [["0", "No"], ["1", "Yes"]] },
      { key: "staircase_type", label: "Staircase shape", default: "narrow", options: [["open", "Open"], ["narrow", "Narrow"], ["tight_turn", "Tight turn"], ["spiral", "Spiral"]] },
      { key: "entrance_steps_band", label: "Steps to front door", default: "few", options: [["none", "None"], ["few", "A few"], ["porch", "Porch"], ["many", "Many"]] },
      { key: "truck_spot", label: "Truck can park", default: "driveway", options: [["driveway", "Driveway/garage"], ["street", "Street"], ["laneway", "Laneway"], ["far", "Far off"]] },
    ],
  },
  {
    key: "condo",
    label: "Condo / apartment",
    archetype: "elevator",
    fields: [
      { key: "unit_floor", label: "Unit floor", numeric: true, default: "10", options: [["3", "1 to 6"], ["10", "7 to 15"], ["22", "16 to 30"], ["34", "30+"]] },
      { key: "elevator_type", label: "Elevator", default: "passenger", options: [["passenger", "Passenger"], ["freight", "Service/freight"], ["both", "Both"], ["none", "Out of service"]] },
      { key: "reserved_window", label: "Reserved elevator window?", boolean: true, default: "0", options: [["0", "Not needed"], ["1", "Yes, booked"]] },
      { key: "carry_band", label: "Lobby-to-truck carry", default: "medium", options: [["short", "Short"], ["medium", "Medium"], ["long", "Long"], ["very_long", "Very long"]] },
      { key: "coi_required", label: "COI required?", boolean: true, default: "0", options: [["0", "No"], ["1", "Yes"]] },
    ],
  },
  {
    key: "walkup",
    label: "Walk-up (no elevator)",
    archetype: "walk_up",
    fields: [
      { key: "unit_floor", label: "Unit floor", numeric: true, default: "3", options: [["2", "2nd"], ["3", "3rd"], ["4", "4th"], ["5", "5th+"]] },
      { key: "stair_type", label: "Stair run", default: "switchback", options: [["straight", "Straight"], ["switchback", "Switchback"], ["exterior", "Exterior"], ["spiral", "Spiral"]] },
      { key: "stair_width_band", label: "Stair width", default: "standard", options: [["roomy", "Roomy"], ["standard", "Standard"], ["tight", "Tight"]] },
      { key: "entrance_steps_band", label: "Steps to entrance", default: "few", options: [["none", "None"], ["few", "A few"], ["porch", "Stoop"], ["many", "Many"]] },
      { key: "truck_spot", label: "Truck can park", default: "street", options: [["driveway", "Out front"], ["street", "Street"], ["laneway", "Laneway"], ["far", "Far off"]] },
    ],
  },
  {
    key: "ground",
    label: "Ground floor / storage",
    archetype: "house",
    fields: [
      { key: "carry_band", label: "Door-to-truck carry", default: "short", options: [["short", "Short"], ["medium", "Medium"], ["long", "Long"], ["very_long", "Very long"]] },
      { key: "truck_spot", label: "Truck can park", default: "driveway", options: [["driveway", "At the door"], ["street", "Street"], ["laneway", "Laneway"], ["far", "Far off"]] },
    ],
  },
];

export function specForType(t: AccessPropertyType): AccessTypeSpec {
  return ACCESS_TYPE_SPECS.find((s) => s.key === t) ?? ACCESS_TYPE_SPECS[0];
}

/** A fresh profile of the given type, with every field at its default. */
export function defaultProfile(t: AccessPropertyType): AccessProfile {
  const spec = specForType(t);
  const p: AccessProfile = { property_type: t };
  for (const f of spec.fields) {
    if (f.boolean) (p as Record<string, unknown>)[f.key] = f.default === "1";
    else if (f.numeric) (p as Record<string, unknown>)[f.key] = Number(f.default);
    else (p as Record<string, unknown>)[f.key] = f.default;
  }
  return p;
}

/** Read the stored value of a field as a string for the option buttons. */
export function fieldValueAsString(profile: AccessProfile, f: AccessFieldSpec): string {
  const v = (profile as Record<string, unknown>)[f.key];
  if (f.boolean) return v === true || v === "1" || v === 1 ? "1" : "0";
  if (v === undefined || v === null) return f.default;
  return String(v);
}

/**
 * Map a captured profile to the flat row deriveAccessModel expects. This is the
 * single bridge between the quote-time capture and the building model, so both
 * the operator readout and (later) pricing use identical math.
 */
export function profileToAccessRow(p: AccessProfile): Record<string, unknown> {
  const spec = specForType(p.property_type);
  const row: Record<string, unknown> = { access_archetype: spec.archetype };

  if (spec.archetype === "house") {
    if (p.property_type === "ground") {
      // Ground/storage: no interior stairs; carry expressed through truck spot.
      row.interior_levels = 1;
      row.entrance_steps_band = "none";
      row.truck_spot = p.truck_spot ?? carryToTruckSpot(p.carry_band);
    } else {
      const levels = (p.interior_levels ?? 1) + (p.finished_basement ? 1 : 0);
      row.interior_levels = levels;
      row.staircase_type = p.staircase_type ?? "open";
      row.entrance_steps_band = p.entrance_steps_band ?? "none";
      row.truck_spot = p.truck_spot ?? "driveway";
    }
  } else if (spec.archetype === "walk_up") {
    const floor = p.unit_floor ?? 1;
    row.unit_floor = floor;
    row.stair_flights = Math.max(0, floor - 1);
    row.stair_type = p.stair_type ?? "straight";
    row.stair_width_band = p.stair_width_band ?? "standard";
    row.entrance_steps_band = p.entrance_steps_band ?? "none";
    row.truck_spot = p.truck_spot ?? "driveway";
  } else {
    // elevator
    row.elevator_type = p.elevator_type ?? "both";
    row.unit_floor = p.unit_floor ?? 1;
    row.carry_band = p.carry_band ?? "short";
    if (p.reserved_window) row.elevator_window_minutes = 30;
    if (p.coi_required) row.coi_required = true;
  }
  return row;
}

function carryToTruckSpot(c: CarryBand | undefined): TruckSpot {
  switch (c) {
    case "very_long":
      return "far";
    case "long":
      return "laneway";
    case "medium":
      return "street";
    default:
      return "driveway";
  }
}

/** Convenience: derive the access model straight from a captured profile. */
export function accessModelFromProfile(p: AccessProfile): AccessModel {
  return deriveAccessModel(profileToAccessRow(p));
}

/**
 * Per-end access surcharge from a captured profile, driven by the derived
 * complexity rating (1–5). Conservative by default: easy access (ground floor,
 * standard elevator, 2nd-floor walk-up) stays $0 so honest jobs are never
 * penalised; genuinely hard access (higher walk-ups, two-stage, long carries)
 * earns a real, bounded premium. Tunable via the `access_profile_surcharge`
 * platform-config JSON (a {complexityRating: dollars} map). This REPLACES the
 * legacy flat access fee + long-carry toggle for a profiled address.
 */
const DEFAULT_COMPLEXITY_SURCHARGE: Record<string, number> = {
  "1": 0,
  "2": 0,
  "3": 100,
  "4": 200,
  "5": 300,
};

export function accessProfileSurcharge(
  p: AccessProfile,
  config?: ConfigLike,
): number {
  const model = accessModelFromProfile(p);
  let table = DEFAULT_COMPLEXITY_SURCHARGE;
  if (config) {
    try {
      const raw = cfgGet(config, "access_profile_surcharge");
      if (raw) table = { ...DEFAULT_COMPLEXITY_SURCHARGE, ...JSON.parse(raw) };
    } catch {
      /* keep defaults */
    }
  }
  const amt = table[String(model.complexityRating)] ?? 0;
  return Math.max(0, Math.round(Number(amt) || 0));
}

/**
 * Legacy-continuity adapter: map a captured profile back to the old
 * access/parking enum so Ship-1 pricing stays on the existing path while the
 * new model is dark. Deliberately conservative (never invents a surcharge the
 * old form wouldn't have applied for the equivalent selection).
 */
export function profileToLegacyAccess(p: AccessProfile): {
  access: string;
  parking: "dedicated" | "no_dedicated";
  longCarry: boolean;
} {
  let access = "ground_floor";
  if (p.property_type === "condo") access = "elevator";
  else if (p.property_type === "walkup") {
    const f = p.unit_floor ?? 2;
    access = f >= 4 ? "walk_up_4th_plus" : f === 3 ? "walk_up_3rd" : "walk_up_2nd";
  } else if ((p.property_type === "house" || p.property_type === "town") && p.finished_basement) {
    access = "basement";
  }
  const longCarry = p.carry_band === "long" || p.carry_band === "very_long" || p.truck_spot === "far";
  const parking: "dedicated" | "no_dedicated" =
    p.truck_spot === "far" || p.truck_spot === "laneway" ? "no_dedicated" : "dedicated";
  return { access, parking, longCarry };
}

const PT_TO_BUILDING_TYPE: Record<AccessPropertyType, string> = {
  house: "detached_house",
  town: "townhouse",
  condo: "high_rise",
  walkup: "walk_up",
  ground: "other",
};

/**
 * Ship 4: map a captured profile + address to the POST body for
 * /api/admin/buildings, so an operator can promote a quote's access capture
 * into a reusable building profile. Carries the derived minutes/complexity so
 * the saved profile prices consistently.
 */
export function profileToBuildingBody(
  p: AccessProfile,
  address: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const row = profileToAccessRow(p);
  const model = deriveAccessModel(row);
  return {
    address,
    building_type: PT_TO_BUILDING_TYPE[p.property_type],
    estimated_extra_minutes_per_trip: model.estimatedExtraMinutesPerTrip,
    complexity_rating: model.complexityRating,
    source: "quote_capture",
    ...row,
    ...(extra ?? {}),
  };
}
