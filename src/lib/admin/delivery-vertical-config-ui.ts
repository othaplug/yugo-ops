/**
 * Maps delivery vertical default_config to/from admin form fields.
 * Preserves keys we do not edit so partner merges and future fields stay intact.
 */

export type DimensionalConfigForm = {
  unitLabel: string;
  unitRate: string;
  minCrew: string;
  minHours: string;
  crewHourlyRate: string;
  stopRate: string;
  freeStops: string;
  distanceFreeKm: string;
  distancePerKm: string;
  minCharge: string;
  handlingThreshold: string;
  handlingRoomOfChoice: string;
  handlingDockToDock: string;
  handlingWhiteGlove: string;
  handlingHandBomb: string;
  truckSprinter: string;
  truck16ft: string;
  truck20ft: string;
  truck26ft: string;
  premTimeSensitive: string;
  premFragile: string;
  premStairsPerFlight: string;
  premAssembly: string;
  premDebris: string;
  weightLight: string;
  weightMedium: string;
  weightHeavy: string;
};

function numStr(v: unknown, fallback = ""): string {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? String(n) : fallback;
}

function strVal(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function coalesceNum(raw: string, fallback: unknown): number {
  const n = parseOptionalNumber(raw);
  if (n !== undefined) return n;
  const p = typeof fallback === "number" ? fallback : Number(fallback);
  return Number.isFinite(p) ? p : 0;
}

export function configToDimensionalForm(config: Record<string, unknown>): DimensionalConfigForm {
  const hr = (config.handling_rates as Record<string, unknown>) || {};
  const tr = (config.truck_rates as Record<string, unknown>) || {};
  const pr = (config.complexity_premiums as Record<string, unknown>) || {};
  const wt = (config.weight_tiers as Record<string, unknown>) || {};
  return {
    unitLabel: strVal(config.unit_label, "item"),
    unitRate: numStr(config.unit_rate, "0"),
    minCrew: numStr(config.min_crew, "2"),
    minHours: numStr(config.min_hours, "1.5"),
    crewHourlyRate: numStr(config.crew_hourly_rate, "75"),
    stopRate: numStr(config.stop_rate, "100"),
    freeStops: numStr(config.free_stops, "1"),
    distanceFreeKm: numStr(config.distance_free_km, "15"),
    distancePerKm: numStr(config.distance_per_km, "3"),
    minCharge: numStr(config.min_charge, ""),
    handlingThreshold: numStr(hr.threshold),
    handlingRoomOfChoice: numStr(hr.room_of_choice),
    handlingDockToDock: numStr(hr.dock_to_dock),
    handlingWhiteGlove: numStr(hr.white_glove),
    handlingHandBomb: numStr(hr.hand_bomb),
    truckSprinter: numStr(tr.sprinter, "0"),
    truck16ft: numStr(tr["16ft"]),
    truck20ft: numStr(tr["20ft"]),
    truck26ft: numStr(tr["26ft"]),
    premTimeSensitive: numStr(pr.time_sensitive),
    premFragile: numStr(pr.fragile),
    premStairsPerFlight: numStr(pr.stairs_per_flight),
    premAssembly: numStr(pr.assembly_required),
    premDebris: numStr(pr.debris_removal),
    weightLight: numStr(wt.light_under_30lbs),
    weightMedium: numStr(wt.medium_30_60lbs),
    weightHeavy: numStr(wt.heavy_over_60lbs),
  };
}

/** Merge form into previous default_config; keep unmanaged root keys and nested keys we do not touch. */
export function applyDimensionalFormToConfig(
  previous: Record<string, unknown>,
  form: DimensionalConfigForm,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...previous };

  out.unit_label = form.unitLabel.trim() || "item";
  out.unit_rate = coalesceNum(form.unitRate, previous.unit_rate);
  out.min_crew = coalesceNum(form.minCrew, previous.min_crew);
  out.min_hours = coalesceNum(form.minHours, previous.min_hours);
  out.crew_hourly_rate = coalesceNum(form.crewHourlyRate, previous.crew_hourly_rate);
  out.stop_rate = coalesceNum(form.stopRate, previous.stop_rate);
  out.free_stops = coalesceNum(form.freeStops, previous.free_stops);
  out.distance_free_km = coalesceNum(form.distanceFreeKm, previous.distance_free_km);
  out.distance_per_km = coalesceNum(form.distancePerKm, previous.distance_per_km);

  const minCh = parseOptionalNumber(form.minCharge);
  if (minCh !== undefined) out.min_charge = minCh;
  else delete out.min_charge;

  const hrPrev = { ...((previous.handling_rates as Record<string, unknown>) || {}) };
  const patchHr = (key: string, raw: string) => {
    const n = parseOptionalNumber(raw);
    if (n !== undefined) hrPrev[key] = n;
    else delete hrPrev[key];
  };
  patchHr("threshold", form.handlingThreshold);
  patchHr("room_of_choice", form.handlingRoomOfChoice);
  patchHr("dock_to_dock", form.handlingDockToDock);
  patchHr("white_glove", form.handlingWhiteGlove);
  patchHr("hand_bomb", form.handlingHandBomb);
  out.handling_rates = hrPrev;

  const trPrev = { ...((previous.truck_rates as Record<string, unknown>) || {}) };
  trPrev.sprinter = coalesceNum(form.truckSprinter, trPrev.sprinter);
  trPrev["16ft"] = coalesceNum(form.truck16ft, trPrev["16ft"]);
  trPrev["20ft"] = coalesceNum(form.truck20ft, trPrev["20ft"]);
  trPrev["26ft"] = coalesceNum(form.truck26ft, trPrev["26ft"]);
  out.truck_rates = trPrev;

  const prPrev = { ...((previous.complexity_premiums as Record<string, unknown>) || {}) };
  const patchPr = (key: string, raw: string) => {
    const n = parseOptionalNumber(raw);
    if (n !== undefined) prPrev[key] = n;
    else delete prPrev[key];
  };
  patchPr("time_sensitive", form.premTimeSensitive);
  patchPr("fragile", form.premFragile);
  patchPr("stairs_per_flight", form.premStairsPerFlight);
  patchPr("assembly_required", form.premAssembly);
  patchPr("debris_removal", form.premDebris);
  out.complexity_premiums = prPrev;

  const wtPrev = { ...((previous.weight_tiers as Record<string, unknown>) || {}) };
  const patchWt = (key: string, raw: string) => {
    const n = parseOptionalNumber(raw);
    if (n !== undefined) wtPrev[key] = n;
    else delete wtPrev[key];
  };
  patchWt("light_under_30lbs", form.weightLight);
  patchWt("medium_30_60lbs", form.weightMedium);
  patchWt("heavy_over_60lbs", form.weightHeavy);
  if (Object.keys(wtPrev).length > 0) out.weight_tiers = wtPrev;
  else delete out.weight_tiers;

  return out;
}

export function defaultDimensionalForm(): DimensionalConfigForm {
  return configToDimensionalForm({
    unit_label: "item",
    unit_rate: 40,
    min_crew: 2,
    min_hours: 2,
    crew_hourly_rate: 80,
    stop_rate: 100,
    free_stops: 1,
    distance_free_km: 15,
    distance_per_km: 3,
    handling_rates: { threshold: 75, room_of_choice: 125 },
    truck_rates: { sprinter: 0, "16ft": 50, "20ft": 100, "26ft": 150 },
    complexity_premiums: { time_sensitive: 100, fragile: 75, stairs_per_flight: 50 },
  });
}
