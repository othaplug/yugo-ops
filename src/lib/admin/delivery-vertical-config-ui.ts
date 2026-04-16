/**
 * Maps delivery vertical default_config to/from admin form fields.
 * Preserves keys we do not edit so partner merges and future fields stay intact.
 */

export type DistanceZoneRow = { minKm: string; maxKm: string; fee: string };
export type VolumeDiscountTierRow = { minMonthly: string; percentOff: string };

export type DimensionalConfigForm = {
  unitLabel: string;
  unitRate: string;
  itemsIncludedInBase: string;
  perItemAfterBase: string;
  assemblyIncluded: boolean;
  skidHandlingFee: string;
  useZoneDistance: boolean;
  distanceZones: DistanceZoneRow[];
  scheduleWeekend: string;
  scheduleAfterHours: string;
  scheduleSameDay: string;
  waiveAfterHours: boolean;
  medicalCombinedSchedule: string;
  sprinterMaxUnits: string;
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
  premArtHanging: string;
  premCrating: string;
  weightLight: string;
  weightMedium: string;
  weightHeavy: string;
  weightExtraHeavy: string;
  volumeDiscountTiers: VolumeDiscountTierRow[];
  largeJobMinCrew: string;
  largeJobItemThreshold: string;
  extraHeavyExtraCrew: string;
  extraHeavyHourlyPerExtra: string;
  extraHeavyMinHours: string;
  flooringStandardMaxLb: string;
  flooringHeavyMaxLb: string;
  flooringHeavyFee: string;
  flooringExtraFee: string;
  flooringExtraThreeCrew: boolean;
  targetMarginPercentDefault: string;
  autoQuoteDisabled: boolean;
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

function zonesFromConfig(config: Record<string, unknown>): DistanceZoneRow[] {
  const z = config.distance_zones;
  if (!Array.isArray(z) || z.length === 0) {
    return [
      { minKm: "0", maxKm: "40", fee: "0" },
      { minKm: "40", maxKm: "80", fee: "75" },
      { minKm: "80", maxKm: "120", fee: "150" },
      { minKm: "120", maxKm: "9999", fee: "175" },
    ];
  }
  return z.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      minKm: numStr(r.min_km, ""),
      maxKm: numStr(r.max_km, ""),
      fee: numStr(r.fee, ""),
    };
  });
}

function volumeTiersFromConfig(config: Record<string, unknown>): VolumeDiscountTierRow[] {
  const v = config.volume_discount_tiers;
  if (!Array.isArray(v) || v.length === 0) return [];
  return v.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      minMonthly: numStr(r.min_monthly_deliveries, ""),
      percentOff: numStr(r.percent_off, ""),
    };
  });
}

export function configToDimensionalForm(config: Record<string, unknown>): DimensionalConfigForm {
  const hr = (config.handling_rates as Record<string, unknown>) || {};
  const tr = (config.truck_rates as Record<string, unknown>) || {};
  const pr = (config.complexity_premiums as Record<string, unknown>) || {};
  const wt = (config.weight_tiers as Record<string, unknown>) || {};
  const sched = (config.schedule_surcharges as Record<string, unknown>) || {};
  const wlr = (config.weight_line_rates as Record<string, unknown>) || {};
  const ehl = (config.extra_heavy_labour as Record<string, unknown>) || {};
  const fl = (config.flooring_load_tiers as Record<string, unknown>) || {};
  return {
    unitLabel: strVal(config.unit_label, "item"),
    unitRate: numStr(config.unit_rate, "0"),
    itemsIncludedInBase: numStr(config.items_included_in_base, ""),
    perItemAfterBase: numStr(config.per_item_rate_after_base, ""),
    assemblyIncluded: config.assembly_included === true,
    skidHandlingFee: numStr(config.skid_handling_fee, ""),
    useZoneDistance: String(config.distance_mode || "") === "zones",
    distanceZones: zonesFromConfig(config),
    scheduleWeekend: numStr(sched.weekend, ""),
    scheduleAfterHours: numStr(sched.after_hours, ""),
    scheduleSameDay: numStr(sched.same_day, ""),
    waiveAfterHours: config.waive_after_hours_surcharge === true,
    medicalCombinedSchedule: numStr(sched.weekend_or_after_hours_combined, ""),
    sprinterMaxUnits: numStr(config.sprinter_max_units, ""),
    minCrew: numStr(config.min_crew, "2"),
    minHours: numStr(config.min_hours, "1.5"),
    crewHourlyRate: numStr(config.crew_hourly_rate, "75"),
    stopRate: numStr(config.stop_rate, "100"),
    freeStops: numStr(config.free_stops, "2"),
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
    premArtHanging: numStr(pr.art_hanging_per_piece),
    premCrating: numStr(pr.crating_per_piece),
    weightLight: numStr(wlr.light !== undefined ? wlr.light : wt.light_under_30lbs, ""),
    weightMedium: numStr(wlr.medium !== undefined ? wlr.medium : wt.medium_30_60lbs, ""),
    weightHeavy: numStr(wlr.heavy !== undefined ? wlr.heavy : wt.heavy_over_60lbs, ""),
    weightExtraHeavy: numStr(wlr.extra_heavy, ""),
    volumeDiscountTiers: volumeTiersFromConfig(config),
    largeJobMinCrew: numStr(config.large_job_min_crew, ""),
    largeJobItemThreshold: numStr(config.large_job_item_threshold, ""),
    extraHeavyExtraCrew: numStr(ehl.extra_crew, ""),
    extraHeavyHourlyPerExtra: numStr(ehl.hourly_per_extra, ""),
    extraHeavyMinHours: numStr(ehl.min_hours, ""),
    flooringStandardMaxLb: numStr(fl.standard_max_lb, ""),
    flooringHeavyMaxLb: numStr(fl.heavy_max_lb, ""),
    flooringHeavyFee: numStr(fl.heavy_fee, ""),
    flooringExtraFee: numStr(fl.extra_fee, ""),
    flooringExtraThreeCrew: fl.extra_three_crew === true,
    targetMarginPercentDefault: numStr(config.target_margin_percent_default, ""),
    autoQuoteDisabled: config.auto_quote_disabled === true,
  };
}

function parseDistanceZones(rows: DistanceZoneRow[]): { min_km: number; max_km: number; fee: number }[] {
  const out: { min_km: number; max_km: number; fee: number }[] = [];
  for (const r of rows) {
    const min_km = parseOptionalNumber(r.minKm);
    const max_km = parseOptionalNumber(r.maxKm);
    const feeRaw = parseOptionalNumber(r.fee);
    if (min_km === undefined || max_km === undefined || feeRaw === undefined) continue;
    out.push({ min_km, max_km, fee: feeRaw });
  }
  return out;
}

function parseVolumeTiers(rows: VolumeDiscountTierRow[]): { min_monthly_deliveries: number; percent_off: number }[] {
  const out: { min_monthly_deliveries: number; percent_off: number }[] = [];
  for (const r of rows) {
    const min_monthly_deliveries = parseOptionalNumber(r.minMonthly);
    const percent_off = parseOptionalNumber(r.percentOff);
    if (min_monthly_deliveries === undefined || percent_off === undefined) continue;
    if (min_monthly_deliveries < 1 || percent_off < 0) continue;
    out.push({ min_monthly_deliveries, percent_off });
  }
  return out.sort((a, b) => a.min_monthly_deliveries - b.min_monthly_deliveries);
}

/** Merge form into previous default_config; keep unmanaged root keys and nested keys we do not touch. */
export function applyDimensionalFormToConfig(
  previous: Record<string, unknown>,
  form: DimensionalConfigForm,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...previous };

  out.unit_label = form.unitLabel.trim() || "item";
  out.unit_rate = coalesceNum(form.unitRate, previous.unit_rate);

  const iib = parseOptionalNumber(form.itemsIncludedInBase);
  if (iib !== undefined) out.items_included_in_base = iib;
  else delete out.items_included_in_base;

  const pia = parseOptionalNumber(form.perItemAfterBase);
  if (pia !== undefined) out.per_item_rate_after_base = pia;
  else delete out.per_item_rate_after_base;

  out.assembly_included = form.assemblyIncluded;

  const skid = parseOptionalNumber(form.skidHandlingFee);
  if (skid !== undefined) out.skid_handling_fee = skid;
  else delete out.skid_handling_fee;

  if (form.useZoneDistance) {
    out.distance_mode = "zones";
    const zones = parseDistanceZones(form.distanceZones);
    out.distance_zones = zones.length > 0 ? zones : [
      { min_km: 0, max_km: 40, fee: 0 },
      { min_km: 40, max_km: 80, fee: 75 },
      { min_km: 80, max_km: 120, fee: 150 },
      { min_km: 120, max_km: 9999, fee: 175 },
    ];
  } else {
    delete out.distance_mode;
    delete out.distance_zones;
  }

  const schedPrev = { ...((previous.schedule_surcharges as Record<string, unknown>) || {}) };
  const patchSched = (key: string, raw: string) => {
    const n = parseOptionalNumber(raw);
    if (n !== undefined) schedPrev[key] = n;
    else delete schedPrev[key];
  };
  patchSched("weekend", form.scheduleWeekend);
  patchSched("after_hours", form.scheduleAfterHours);
  patchSched("same_day", form.scheduleSameDay);
  const mc = parseOptionalNumber(form.medicalCombinedSchedule);
  if (mc !== undefined) schedPrev.weekend_or_after_hours_combined = mc;
  else delete schedPrev.weekend_or_after_hours_combined;
  if (Object.keys(schedPrev).length > 0) out.schedule_surcharges = schedPrev;
  else delete out.schedule_surcharges;

  out.waive_after_hours_surcharge = form.waiveAfterHours;
  const mcNum = parseOptionalNumber(form.medicalCombinedSchedule);
  if (mcNum !== undefined && mcNum > 0) out.medical_combined_schedule_surcharge = true;
  else delete out.medical_combined_schedule_surcharge;

  const smu = parseOptionalNumber(form.sprinterMaxUnits);
  if (smu !== undefined) out.sprinter_max_units = smu;
  else delete out.sprinter_max_units;

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
  patchPr("art_hanging_per_piece", form.premArtHanging);
  patchPr("crating_per_piece", form.premCrating);
  out.complexity_premiums = prPrev;

  const wtPrev = { ...((previous.weight_tiers as Record<string, unknown>) || {}) };
  const patchWt = (key: string, raw: string) => {
    const n = parseOptionalNumber(raw);
    if (n !== undefined) wtPrev[key] = n;
    else delete wtPrev[key];
  };
  const hasLineWeight =
    form.weightLight.trim() !== "" ||
    form.weightMedium.trim() !== "" ||
    form.weightHeavy.trim() !== "" ||
    form.weightExtraHeavy.trim() !== "";
  if (hasLineWeight) {
    delete out.weight_tiers;
    const wlrPrev = { ...((previous.weight_line_rates as Record<string, unknown>) || {}) };
    const patchWlr = (key: string, raw: string) => {
      const n = parseOptionalNumber(raw);
      if (n !== undefined) wlrPrev[key] = n;
      else delete wlrPrev[key];
    };
    patchWlr("light", form.weightLight);
    patchWlr("medium", form.weightMedium);
    patchWlr("heavy", form.weightHeavy);
    patchWlr("extra_heavy", form.weightExtraHeavy);
    if (Object.keys(wlrPrev).length > 0) out.weight_line_rates = wlrPrev;
    else delete out.weight_line_rates;
  } else {
    delete out.weight_line_rates;
    patchWt("light_under_30lbs", form.weightLight);
    patchWt("medium_30_60lbs", form.weightMedium);
    patchWt("heavy_over_60lbs", form.weightHeavy);
    if (Object.keys(wtPrev).length > 0) out.weight_tiers = wtPrev;
    else delete out.weight_tiers;
  }

  const vol = parseVolumeTiers(form.volumeDiscountTiers);
  if (vol.length > 0) out.volume_discount_tiers = vol;
  else delete out.volume_discount_tiers;

  const ljm = parseOptionalNumber(form.largeJobMinCrew);
  const ljt = parseOptionalNumber(form.largeJobItemThreshold);
  if (ljm !== undefined && ljm >= 1) out.large_job_min_crew = ljm;
  else delete out.large_job_min_crew;
  if (ljt !== undefined && ljt >= 1) out.large_job_item_threshold = ljt;
  else delete out.large_job_item_threshold;

  const ehlBlank =
    !form.extraHeavyExtraCrew.trim() && !form.extraHeavyHourlyPerExtra.trim() && !form.extraHeavyMinHours.trim();
  if (ehlBlank) {
    delete out.extra_heavy_labour;
  } else {
    const prevEhl = (previous.extra_heavy_labour as Record<string, unknown>) || {};
    const exc = parseOptionalNumber(form.extraHeavyExtraCrew) ?? Number(prevEhl.extra_crew);
    const exh = parseOptionalNumber(form.extraHeavyHourlyPerExtra) ?? Number(prevEhl.hourly_per_extra);
    const exm = parseOptionalNumber(form.extraHeavyMinHours) ?? Number(prevEhl.min_hours);
    if (Number.isFinite(exc) && exc >= 1 && Number.isFinite(exh) && exh > 0 && Number.isFinite(exm) && exm > 0) {
      out.extra_heavy_labour = { extra_crew: exc, hourly_per_extra: exh, min_hours: exm };
    }
  }

  const flooringBlank =
    !form.flooringStandardMaxLb.trim() &&
    !form.flooringHeavyMaxLb.trim() &&
    !form.flooringHeavyFee.trim() &&
    !form.flooringExtraFee.trim() &&
    !form.flooringExtraThreeCrew;
  if (flooringBlank) {
    delete out.flooring_load_tiers;
  } else {
    const prevFl = (previous.flooring_load_tiers as Record<string, unknown>) || {};
    const prevNum = (k: string, fallback: number) => {
      const n = Number(prevFl[k]);
      return Number.isFinite(n) ? n : fallback;
    };
    const fStd = parseOptionalNumber(form.flooringStandardMaxLb) ?? prevNum("standard_max_lb", 1000);
    const fHvy = parseOptionalNumber(form.flooringHeavyMaxLb) ?? prevNum("heavy_max_lb", 2500);
    const fHfee = parseOptionalNumber(form.flooringHeavyFee) ?? prevNum("heavy_fee", 0);
    const fEfee = parseOptionalNumber(form.flooringExtraFee) ?? prevNum("extra_fee", 0);
    out.flooring_load_tiers = {
      standard_max_lb: fStd,
      heavy_max_lb: fHvy,
      heavy_fee: fHfee,
      extra_fee: fEfee,
      extra_three_crew: form.flooringExtraThreeCrew,
    };
  }

  const tmg = parseOptionalNumber(form.targetMarginPercentDefault);
  if (tmg !== undefined && tmg > 0 && tmg <= 100) out.target_margin_percent_default = tmg;
  else delete out.target_margin_percent_default;

  if (form.autoQuoteDisabled) out.auto_quote_disabled = true;
  else delete out.auto_quote_disabled;

  return out;
}

export function defaultDimensionalForm(): DimensionalConfigForm {
  const base = configToDimensionalForm({
    unit_label: "item",
    unit_rate: 40,
    assembly_included: true,
    min_crew: 2,
    min_hours: 2,
    crew_hourly_rate: 80,
    stop_rate: 100,
    free_stops: 2,
    distance_free_km: 15,
    distance_per_km: 3,
    handling_rates: { threshold: 75, room_of_choice: 125 },
    truck_rates: { sprinter: 0, "16ft": 60, "20ft": 120, "26ft": 200 },
    complexity_premiums: {
      time_sensitive: 100,
      fragile: 75,
      stairs_per_flight: 50,
      art_hanging_per_piece: 0,
      crating_per_piece: 0,
    },
    weight_line_rates: { light: 0, medium: 0, heavy: 0, extra_heavy: 0 },
  });
  return { ...base, assemblyIncluded: true, waiveAfterHours: false, useZoneDistance: false };
}
