/**
 * Universal B2B / logistics dimensional pricing (vertical config from DB).
 * Distance is supplied by caller (Mapbox multi-stop or point-to-point).
 */

import { extractMaxWeightLbsFromText } from "@/lib/leads/parse-text-metrics";
import { inferB2bWeightCategoryFromLbs } from "./b2b-weight-helpers";

export type B2BWeightCategory = "light" | "medium" | "heavy" | "extra_heavy";

export interface B2BQuoteLineItem {
  description: string;
  quantity: number;
  weight_category?: B2BWeightCategory;
  /** Per-line weight when known (medical crew rules, parsing). */
  weight_lbs?: number;
  fragile?: boolean;
  dimensions?: string;
  /** Per-line handling (dimensional engine); falls back to quote-level handling_type. */
  handling_type?: string;
  /** Flooring accessories bundled with order — excluded from tiered "items in base" counts only. */
  bundled?: boolean;
  assembly_required?: boolean;
  debris_removal?: boolean;
  /** Appliance vertical: haul-away per unit. */
  haul_away?: boolean;
  /** Skid / pallet line — contributes to skid handling count. */
  is_skid?: boolean;
  /** Flooring: box | roll | bundle | piece | bag | pallet | unit — drives per-line handling. */
  unit_type?: string;
  /** Line-level metadata / pricing hints */
  serial_number?: string;
  stop_assignment?: string;
  declared_value?: string;
  crating_required?: boolean;
  hookup_required?: boolean;
}

export interface B2BStopInput {
  address: string;
  type: "pickup" | "delivery";
  access?: string;
  items_at_stop?: string[];
  time_window?: string;
}

export interface B2BDimensionalQuoteInput {
  vertical_code: string;
  items: B2BQuoteLineItem[];
  handling_type: string;
  stops: B2BStopInput[];
  crew_override?: number;
  truck_override?: string;
  estimated_hours_override?: number;
  time_sensitive?: boolean;
  assembly_required?: boolean;
  debris_removal?: boolean;
  stairs_flights?: number;
  /** Extra complexity keys present on vertical complexity_premiums (e.g. tv_mounting) */
  addons?: string[];
  /** Schedule / access add-ons (from quote form) */
  weekend?: boolean;
  after_hours?: boolean;
  same_day?: boolean;
  skid_count?: number;
  /** Total load weight for flooring-style verticals */
  total_load_weight_lbs?: number;
  haul_away_units?: number;
  returns_pickup?: boolean;
  /** Estimated monthly deliveries for this account — applies volume_discount_tiers from vertical config. */
  monthly_delivery_volume?: number;
  /** Art & gallery: pieces to hang (× art_hanging_per_piece from complexity_premiums). */
  art_hanging_count?: number;
  /** Art & gallery / specialty: crated pieces (× crating_per_piece when set on vertical). */
  crating_pieces?: number;
}

export interface DeliveryVerticalRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  base_rate: number;
  pricing_method: string;
  default_config: Record<string, unknown>;
  active: boolean;
  sort_order: number;
}

export interface PriceBreakdownLine {
  label: string;
  amount: number;
}

/** Pre-tax subtotal before coordinator add-ons; caller adds addons then HST. */
export interface B2BDimensionalPriceResult {
  subtotal: number;
  breakdown: PriceBreakdownLine[];
  includes: string[];
  truck: string;
  crew: number;
  estimatedHours: number;
  totalDistanceKm: number;
  stopCount: number;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Deep-merge nested objects for partner overrides */
export function mergeVerticalConfig(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === null || v === undefined) continue;
    const b = base[k];
    if (
      typeof v === "object" &&
      !Array.isArray(v) &&
      b !== null &&
      typeof b === "object" &&
      !Array.isArray(b)
    ) {
      out[k] = mergeVerticalConfig(b as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function recommendTruckForB2B(
  _items: B2BQuoteLineItem[],
  totalUnits: number,
  rates?: Record<string, unknown>,
): string {
  const smu = num(rates?.sprinter_max_units, 5);
  let rec: string;
  if (totalUnits <= smu) rec = "sprinter";
  else if (totalUnits <= 20) rec = "16ft";
  else if (totalUnits <= 80) rec = "20ft";
  else rec = "26ft";
  const minTruck = str(rates?.minimum_truck, "")
    .toLowerCase()
    .replace(/\s+/g, "");
  if (minTruck === "16ft" && rec === "sprinter") rec = "16ft";
  if (minTruck === "20ft" && (rec === "sprinter" || rec === "16ft")) rec = "20ft";
  if (minTruck === "26ft") rec = "26ft";
  return rec;
}

function distanceZoneFee(distKm: number, zones: unknown): number {
  if (!Array.isArray(zones) || zones.length === 0) return 0;
  for (const z of zones) {
    if (typeof z !== "object" || !z) continue;
    const o = z as Record<string, unknown>;
    const mn = num(o.min_km, 0);
    const mx = num(o.max_km, 99999);
    const fee = num(o.fee, 0);
    if (distKm >= mn && distKm < mx) return fee;
  }
  const last = zones[zones.length - 1] as Record<string, unknown>;
  return num(last?.fee, 0);
}

/** Pick best volume tier (highest qualifying min_monthly_deliveries). Returns percent 0–100. */
export function volumeDiscountPercentForCount(monthlyCount: number, tiers: unknown): number {
  if (!Array.isArray(tiers) || monthlyCount <= 0) return 0;
  type Row = { min_monthly_deliveries?: number; percent_off?: number };
  const rows = tiers
    .filter((t): t is Row => t != null && typeof t === "object")
    .map((t) => ({ m: num(t.min_monthly_deliveries, -1), p: num(t.percent_off, 0) }))
    .filter((r) => r.m >= 0 && r.p > 0 && monthlyCount >= r.m)
    .sort((a, b) => b.m - a.m);
  return rows[0]?.p ?? 0;
}

export function estimateB2BHours(input: B2BDimensionalQuoteInput, rates: Record<string, unknown>): number {
  const totalUnits = input.items.reduce((s, i) => s + Math.max(0, i.quantity), 0);
  const stops = input.stops.length;
  let hours = 0.5;
  const ht = (input.handling_type || "").toLowerCase();

  if (ht === "hand_bomb") {
    hours += totalUnits * 0.02;
  } else if (ht === "white_glove") {
    hours += totalUnits * 0.25;
  } else if (ht === "room_of_choice" || ht === "room_placement") {
    hours += totalUnits * 0.15;
  } else {
    hours += totalUnits * 0.08;
  }

  hours += stops * 0.25;
  hours = Math.max(hours, num(rates.min_hours, 1.5));
  return Math.round(hours * 2) / 2;
}

/** Parse legacy `b2b_items` strings like "Sofa ×2" or "Box x3" */
export function parseLegacyB2bItemStrings(strings: string[]): B2BQuoteLineItem[] {
  const out: B2BQuoteLineItem[] = [];
  for (const raw of strings) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.match(/^(.+?)\s*[×x]\s*(\d+)\s*$/i);
    if (m) {
      out.push({ description: m[1]!.trim(), quantity: Math.max(1, parseInt(m[2]!, 10)) });
    } else {
      out.push({ description: s, quantity: 1 });
    }
  }
  return out;
}

export function synthesizeStopsFromAddresses(
  fromAddress: string,
  toAddress: string,
  fromAccess?: string,
  toAccess?: string,
): B2BStopInput[] {
  return [
    { type: "pickup", address: fromAddress.trim(), access: fromAccess },
    { type: "delivery", address: toAddress.trim(), access: toAccess },
  ];
}

function mapLegacyWeightCategory(cat: string | undefined): B2BWeightCategory | undefined {
  const c = (cat || "").toLowerCase();
  if (c === "standard" || c === "light") return "light";
  if (c === "heavy") return "medium";
  if (c === "very_heavy") return "heavy";
  if (c === "oversized_fragile") return "extra_heavy";
  return undefined;
}

function enrichB2bLineItems(
  lines: B2BQuoteLineItem[],
  verticalCode: string,
  legacyWc?: B2BWeightCategory,
): B2BQuoteLineItem[] {
  const vcode = verticalCode.trim().toLowerCase() || "furniture_retail";
  const wcGlobal = legacyWc;
  return lines.map((i) => {
    const ext = i as B2BQuoteLineItem & { haul_away_old?: boolean };
    const iNorm: B2BQuoteLineItem = {
      ...i,
      haul_away: !!(i.haul_away || ext.haul_away_old),
    };
    const q = Math.max(1, iNorm.quantity || 1);
    let weight_lbs = iNorm.weight_lbs;
    if (weight_lbs == null || !Number.isFinite(weight_lbs)) {
      const fromText = extractMaxWeightLbsFromText(iNorm.description);
      if (fromText != null) weight_lbs = Math.round(fromText);
    }
    let wc = iNorm.weight_category ?? wcGlobal;
    if (!wc && weight_lbs != null && weight_lbs > 0) {
      wc = inferB2bWeightCategoryFromLbs(weight_lbs, vcode);
    }
    return {
      ...iNorm,
      quantity: q,
      weight_category: wc,
      weight_lbs: weight_lbs != null && Number.isFinite(weight_lbs) ? weight_lbs : undefined,
    };
  });
}

export function lineItemsFromQuotePayload(input: {
  b2b_line_items?: B2BQuoteLineItem[];
  b2b_items?: string[];
  b2b_weight_category?: string;
  b2b_vertical_code?: string;
  /** When true, return [] if no line items (no synthetic "Delivery" row). */
  omit_placeholder?: boolean;
}): B2BQuoteLineItem[] {
  const vcode = (input.b2b_vertical_code || "furniture_retail").trim() || "furniture_retail";
  if (input.b2b_line_items && input.b2b_line_items.length > 0) {
    const wc = mapLegacyWeightCategory(input.b2b_weight_category);
    return enrichB2bLineItems(input.b2b_line_items, vcode, wc);
  }
  if (input.b2b_items && input.b2b_items.length > 0) {
    const parsed = parseLegacyB2bItemStrings(input.b2b_items);
    const wc = mapLegacyWeightCategory(input.b2b_weight_category);
    return enrichB2bLineItems(parsed, vcode, wc);
  }
  if (input.omit_placeholder) return [];
  return enrichB2bLineItems(
    [{ description: "Delivery", quantity: 1 }],
    vcode,
    mapLegacyWeightCategory(input.b2b_weight_category),
  );
}

export function stopsFromQuotePayload(input: {
  from_address: string;
  to_address: string;
  from_access?: string;
  to_access?: string;
  b2b_stops?: B2BStopInput[];
}): B2BStopInput[] {
  if (input.b2b_stops && input.b2b_stops.length >= 2) {
    return input.b2b_stops
      .map(
        (s): B2BStopInput => ({
          ...s,
          address: s.address?.trim() || "",
          type: s.type === "delivery" ? "delivery" : "pickup",
        }),
      )
      .filter((s) => s.address.length > 0);
  }
  return synthesizeStopsFromAddresses(input.from_address, input.to_address, input.from_access, input.to_access);
}

/** Flat surcharges appended to dimensional subtotal (e.g. weekend, outside-GTA zones). */
export interface B2BPricingExtraLine {
  label: string;
  amount: number;
}

/** True when move_date is Saturday or Sunday (local calendar day). */
export function isMoveDateWeekend(isoDate: string): boolean {
  const raw = isoDate?.trim();
  if (!raw) return false;
  const d = new Date(`${raw}T12:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function normalizeHandlingKey(ht: string): string {
  const h = ht.trim().toLowerCase();
  if (h === "room_of_choice") return "room_placement";
  return h;
}

/** One handling tier / group (subset of items) — returns charge added. */
function handlingChargeForType(
  htRaw: string,
  units: number,
  dimOn: boolean,
  handlingRates: Record<string, number>,
  breakdown: PriceBreakdownLine[],
): number {
  if (!dimOn || units <= 0) return 0;
  const ht = normalizeHandlingKey(htRaw);

  const perBoxKeys: { key: string; label: string; rateKey: string }[] = [
    { key: "hand_bomb", label: "Hand-bomb", rateKey: "hand_bomb_per_box" },
    { key: "carry_in", label: "Carry-in", rateKey: "carry_in_per_box" },
    { key: "room_placement", label: "Room placement", rateKey: "room_placement" },
  ];
  for (const row of perBoxKeys) {
    if (ht === row.key && handlingRates[row.rateKey] != null) {
      const r = num(handlingRates[row.rateKey], 0);
      const charge = Math.round(units * r * 100) / 100;
      if (charge !== 0) {
        breakdown.push({
          label: `${row.label}: ${units} × ${fmtMoney(r)}`,
          amount: charge,
        });
      }
      return charge;
    }
  }

  const raw = handlingRates[ht] ?? handlingRates[htRaw];
  if (typeof raw === "number" && raw !== 0) {
    if (raw > 0 && raw < 10 && ht === "hand_bomb") {
      const charge = Math.round(units * raw * 100) / 100;
      breakdown.push({
        label: `Hand-bomb: ${units} × ${fmtMoney(raw)}`,
        amount: charge,
      });
      return charge;
    }
    breakdown.push({
      label: `${ht.replace(/_/g, " ")} handling`,
      amount: raw,
    });
    return raw;
  }
  return 0;
}

export function calculateB2BDimensionalPrice(args: {
  vertical: DeliveryVerticalRow;
  mergedRates: Record<string, unknown>;
  input: B2BDimensionalQuoteInput;
  totalDistanceKm: number;
  roundingNearest: number;
  parkingLongCarryTotal?: number;
  /** Applied before minimum charge / final rounding bucket. */
  pricingExtras?: B2BPricingExtraLine[];
}): B2BDimensionalPriceResult {
  const vc = args.mergedRates;
  const method = (args.vertical.pricing_method || "dimensional").toLowerCase();
  let totalPrice = num(args.vertical.base_rate, 0);
  const breakdown: PriceBreakdownLine[] = [];

  breakdown.push({
    label: `Base rate (${args.vertical.name})`,
    amount: num(args.vertical.base_rate, 0),
  });

  const items = args.input.items.filter((i) => i.quantity > 0 && i.description.trim());
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const tierBillableUnits = items
    .filter((i) => !i.bundled)
    .reduce((s, i) => s + i.quantity, 0);

  const unitLabel = str(vc.unit_label, "item");
  const unitRate = num(vc.unit_rate, 0);

  const dimOn = method !== "flat" && method !== "hourly";
  const includeUnits = dimOn;
  const itemsIncludedBase = vc.items_included_in_base;
  const perItemAfterBase = num(vc.per_item_rate_after_base, NaN);
  const usesTieredItems =
    includeUnits &&
    itemsIncludedBase != null &&
    typeof itemsIncludedBase === "number" &&
    Number.isFinite(itemsIncludedBase) &&
    Number.isFinite(perItemAfterBase);

  if (usesTieredItems) {
    const extra = Math.max(0, tierBillableUnits - itemsIncludedBase!);
    if (extra > 0) {
      const unitCharge = Math.round(extra * perItemAfterBase * 100) / 100;
      totalPrice += unitCharge;
      breakdown.push({
        label: `Additional ${unitLabel}s (${extra} beyond ${itemsIncludedBase}) × ${fmtMoney(perItemAfterBase)}`,
        amount: unitCharge,
      });
    }
  } else if (includeUnits && unitRate > 0 && tierBillableUnits > 0) {
    const unitCharge = Math.round(tierBillableUnits * unitRate * 100) / 100;
    totalPrice += unitCharge;
    breakdown.push({
      label: `${tierBillableUnits} ${unitLabel}(s) × ${fmtMoney(unitRate)}`,
      amount: unitCharge,
    });
  }

  const handlingRates = (vc.handling_rates as Record<string, number> | undefined) || {};
  const defaultHt = (args.input.handling_type || "threshold").toLowerCase();
  const handlingGroups = new Map<string, number>();
  for (const item of items) {
    const lineHt = (item.handling_type || defaultHt).toLowerCase();
    if (lineHt === "skid_drop") continue;
    handlingGroups.set(lineHt, (handlingGroups.get(lineHt) ?? 0) + item.quantity);
  }
  let handlingCharge = 0;
  for (const [ht, units] of handlingGroups) {
    handlingCharge += handlingChargeForType(ht, units, dimOn, handlingRates, breakdown);
  }
  totalPrice += handlingCharge;

  const wlr = vc.weight_line_rates as Record<string, number> | undefined;
  if (wlr && typeof wlr === "object" && dimOn) {
    for (const item of items) {
      const cat = item.weight_category || "light";
      const tierRate = num(wlr[String(cat)], 0);
      if (tierRate > 0) {
        const weightCharge = Math.round(item.quantity * tierRate * 100) / 100;
        totalPrice += weightCharge;
        breakdown.push({
          label: `Weight surcharge (${item.description}): ${item.quantity} × ${fmtMoney(tierRate)}`,
          amount: weightCharge,
        });
      }
    }
  }

  const weightTiers = vc.weight_tiers as Record<string, number> | undefined;
  if (!wlr && weightTiers && dimOn) {
    for (const item of items) {
      const tierKey =
        item.weight_category === "heavy" || item.weight_category === "extra_heavy"
          ? "heavy_over_60lbs"
          : item.weight_category === "medium"
            ? "medium_30_60lbs"
            : "light_under_30lbs";
      const tierRate = num(weightTiers[tierKey], 0);
      if (tierRate > 0) {
        const weightCharge = Math.round(item.quantity * tierRate * 100) / 100;
        totalPrice += weightCharge;
        breakdown.push({
          label: `Weight surcharge (${item.description}): ${item.quantity} × ${fmtMoney(tierRate)}`,
          amount: weightCharge,
        });
      }
    }
  }

  const summedLineLbs = items.reduce((s, i) => {
    const w = i.weight_lbs;
    if (w != null && Number.isFinite(w) && w > 0) return s + w * i.quantity;
    return s;
  }, 0);
  const fl = vc.flooring_load_tiers as Record<string, unknown> | undefined;
  const loadLbs =
    args.input.total_load_weight_lbs != null && args.input.total_load_weight_lbs > 0
      ? args.input.total_load_weight_lbs
      : summedLineLbs > 0
        ? summedLineLbs
        : undefined;
  if (fl && dimOn && loadLbs != null && loadLbs > 0) {
    const sm = num(fl.standard_max_lb, 1000);
    const hm = num(fl.heavy_max_lb, 2500);
    let loadFee = 0;
    let loadLabel = "";
    if (loadLbs > hm) {
      loadFee = num(fl.extra_fee, 80);
      loadLabel = `Heavy load (${loadLbs} lbs total)`;
      if (fl.extra_three_crew === true) {
        const hr = num(vc.crew_hourly_rate, 75);
        const extraLabour = Math.round(1 * hr * num(vc.min_hours, 2) * 100) / 100;
        totalPrice += extraLabour;
        breakdown.push({ label: "Extra crew (heavy flooring load)", amount: extraLabour });
      }
    } else if (loadLbs > sm) {
      loadFee = num(fl.heavy_fee, 40);
      loadLabel = `Load weight tier (${loadLbs} lbs total)`;
    }
    if (loadFee > 0) {
      totalPrice += loadFee;
      breakdown.push({ label: loadLabel, amount: loadFee });
    }
  }

  const skidFee = num(vc.skid_handling_fee, 0);
  const skidsFromLines = items.reduce((s, i) => {
    if (i.is_skid) return s + i.quantity;
    const d = i.description.trim().toLowerCase();
    if (/\bskid\b/.test(d) || /\bpallet\b/.test(d)) return s + i.quantity;
    return s;
  }, 0);
  const skids = Math.max(0, args.input.skid_count ?? 0, skidsFromLines);
  if (dimOn && skidFee > 0 && skids > 0) {
    const sc = Math.round(skidFee * skids * 100) / 100;
    totalPrice += sc;
    breakdown.push({ label: `Skid handling (${skids} skid(s))`, amount: sc });
  }

  const haulFromLines = items.reduce((s, i) => (i.haul_away ? s + i.quantity : s), 0);
  const haulUnits = Math.max(0, args.input.haul_away_units ?? 0, haulFromLines);
  const haulPer = num(vc.haul_away_per_unit, 0);
  if (dimOn && haulUnits > 0 && haulPer > 0) {
    const hc = Math.round(haulUnits * haulPer * 100) / 100;
    totalPrice += hc;
    breakdown.push({ label: `Haul-away (${haulUnits} unit(s))`, amount: hc });
  }

  if (dimOn && args.input.returns_pickup && num(vc.returns_pickup_flat, 0) > 0) {
    const rp = num(vc.returns_pickup_flat, 0);
    totalPrice += rp;
    breakdown.push({ label: "Returns pickup", amount: rp });
  }

  const unitOver300Lb = items.some((i) => (i.weight_lbs ?? 0) > 300);
  const medicalNeedsThreeCrew = args.vertical.code === "medical_equipment" && unitOver300Lb;
  const heavyItemNeedsThreeCrew = unitOver300Lb && args.vertical.code !== "medical_equipment";
  if (dimOn && medicalNeedsThreeCrew) {
    const hr = num(vc.crew_hourly_rate, 95);
    const mh = num(vc.min_hours, 3);
    const add = Math.round(1 * hr * mh * 100) / 100;
    totalPrice += add;
    breakdown.push({ label: "Third crew member (unit over 300 lb)", amount: add });
  } else if (dimOn && heavyItemNeedsThreeCrew) {
    const hr = num(vc.crew_hourly_rate, 75);
    const mh = num(vc.min_hours, 2);
    const add = Math.round(1 * hr * mh * 100) / 100;
    totalPrice += add;
    breakdown.push({ label: "Third crew member (item over 300 lb)", amount: add });
  }

  const anyExtraHeavy = items.some((i) => i.weight_category === "extra_heavy");
  const ehl = vc.extra_heavy_labour as Record<string, unknown> | undefined;
  if (dimOn && anyExtraHeavy && ehl) {
    const ec = num(ehl.extra_crew, 0);
    const hr = num(ehl.hourly_per_extra, 0);
    const mh = num(ehl.min_hours, 2);
    if (ec > 0 && hr > 0) {
      const lab = Math.round(ec * hr * mh * 100) / 100;
      totalPrice += lab;
      breakdown.push({
        label: `Mandatory extra crew (${ec} × ${mh} hr min × ${fmtMoney(hr)})`,
        amount: lab,
      });
    }
  }

  const stops = args.input.stops.filter((s) => s.address.trim().length > 0);
  const totalStops = Math.max(stops.length, 2);
  const freeStops = num(vc.stops_included_in_base, num(vc.free_stops, 1));
  const extraStops = Math.max(0, totalStops - freeStops);
  const stopRate = num(vc.stop_rate, 75);

  if (extraStops > 0 && dimOn) {
    const stopCharge = extraStops * stopRate;
    totalPrice += stopCharge;
    breakdown.push({
      label: `${extraStops} extra stop(s) × ${fmtMoney(stopRate)}`,
      amount: stopCharge,
    });
  }

  const recommendedTruck = recommendTruckForB2B(items, totalUnits, vc);
  const truck = (args.input.truck_override || recommendedTruck).toLowerCase().replace(/\s+/g, "");
  const truckRates = (vc.truck_rates as Record<string, number> | undefined) || {};
  const truckSurcharge = num(truckRates[truck], 0);
  if (truckSurcharge > 0 && method !== "flat") {
    totalPrice += truckSurcharge;
    breakdown.push({ label: `${truck} truck`, amount: truckSurcharge });
  }

  const distKm = Math.max(0, args.totalDistanceKm);
  const dmode = str(vc.distance_mode, "");
  if (dmode === "zones" && method !== "flat") {
    const zfee = distanceZoneFee(distKm, vc.distance_zones);
    if (zfee > 0) {
      totalPrice += zfee;
      breakdown.push({
        label: `Distance zone (${distKm.toFixed(1)} km route)`,
        amount: zfee,
      });
    }
  } else {
    const freeKm = num(vc.distance_free_km, 15);
    const perKm = num(vc.distance_per_km, 3);
    const chargeableKm = Math.max(0, distKm - freeKm);

    if (chargeableKm > 0 && method !== "flat") {
      const distanceCharge = Math.round(chargeableKm * perKm);
      totalPrice += distanceCharge;
      breakdown.push({
        label: `Distance: ${chargeableKm.toFixed(1)} km × ${fmtMoney(perKm)}`,
        amount: distanceCharge,
      });
    }
  }

  const applyVerticalSchedule = dmode === "zones";
  const sched = vc.schedule_surcharges as Record<string, number> | undefined;
  const waiveAh = vc.waive_after_hours_surcharge === true;
  const medCombo = vc.medical_combined_schedule_surcharge === true;
  if (dimOn && applyVerticalSchedule && sched) {
    if (medCombo && num(sched.weekend_or_after_hours_combined, 0) > 0) {
      if (args.input.weekend || args.input.after_hours) {
        const a = num(sched.weekend_or_after_hours_combined, 0);
        totalPrice += a;
        breakdown.push({ label: "Weekend / after-hours (medical)", amount: a });
      }
    } else {
      if (args.input.weekend && num(sched.weekend, 0) > 0) {
        const w = num(sched.weekend, 0);
        totalPrice += w;
        breakdown.push({ label: "Weekend delivery", amount: w });
      }
      if (args.input.after_hours && !waiveAh && num(sched.after_hours, 0) > 0) {
        const ah = num(sched.after_hours, 0);
        totalPrice += ah;
        breakdown.push({ label: "After-hours delivery", amount: ah });
      }
    }
    if (args.input.same_day && num(sched.same_day, 0) > 0) {
      const sd = num(sched.same_day, 0);
      totalPrice += sd;
      breakdown.push({ label: "Same-day delivery", amount: sd });
    }
  }

  const prem = (vc.complexity_premiums as Record<string, number> | undefined) || {};

  const applyPremium = (key: string, condition: boolean) => {
    if (!condition) return;
    const raw = prem[key];
    if (typeof raw !== "number" || raw <= 0) return;
    if (raw > 0 && raw < 1) {
      const add = Math.round(totalPrice * raw);
      totalPrice += add;
      breakdown.push({ label: `${key.replace(/_/g, " ")} (${Math.round(raw * 100)}% subtotal)`, amount: add });
      return;
    }
    totalPrice += raw;
    breakdown.push({ label: key.replace(/_/g, " "), amount: raw });
  };

  const assemblyAny = !!args.input.assembly_required || items.some((i) => i.assembly_required);
  const debrisAny = !!args.input.debris_removal || items.some((i) => i.debris_removal);

  if (dimOn) {
    applyPremium("time_sensitive", !!args.input.time_sensitive);
    if (assemblyAny) {
      if (vc.assembly_included === true) {
        /* assembly bundled in base */
      } else if (num(vc.assembly_addon_flat, 0) > 0) {
        const af = num(vc.assembly_addon_flat, 0);
        totalPrice += af;
        breakdown.push({ label: "Assembly add-on", amount: af });
      } else {
        applyPremium("assembly_required", true);
      }
    }
    applyPremium("debris_removal", debrisAny);

    if (args.input.stairs_flights && args.input.stairs_flights > 0) {
      const stairRate = num(prem.stairs_per_flight, 50);
      const stairCharge = args.input.stairs_flights * stairRate;
      totalPrice += stairCharge;
      breakdown.push({
        label: `Stair carry: ${args.input.stairs_flights} flight(s)`,
        amount: stairCharge,
      });
    }

    const anyFragile = items.some((i) => i.fragile);
    if (anyFragile) applyPremium("fragile", true);

    for (const key of args.input.addons || []) {
      if (key === "haul_away_old" && haulUnits > 0) continue;
      applyPremium(key, true);
    }

    const hangRate = num(prem.art_hanging_per_piece, 0);
    const hangN = Math.max(0, args.input.art_hanging_count ?? 0);
    if (hangN > 0 && hangRate > 0) {
      const h = Math.round(hangN * hangRate * 100) / 100;
      totalPrice += h;
      breakdown.push({ label: `Art hanging (${hangN} piece(s))`, amount: h });
    }
    const crateRate = num(prem.crating_per_piece, 0);
    const crateFromLines = items.reduce(
      (s, i) => (i.crating_required ? s + Math.max(1, i.quantity) : s),
      0,
    );
    const crateN = Math.max(0, args.input.crating_pieces ?? 0, crateFromLines);
    if (crateN > 0 && crateRate > 0) {
      const c = Math.round(crateN * crateRate * 100) / 100;
      totalPrice += c;
      breakdown.push({ label: `Crating (${crateN} piece(s))`, amount: c });
    }
  }

  if (method === "hourly") {
    const hr = num(vc.crew_hourly_rate, 75);
    const crew = args.input.crew_override ?? num(vc.min_crew, 2);
    const hours =
      args.input.estimated_hours_override ?? estimateB2BHours(args.input, vc);
    const labour = Math.round(crew * hours * hr);
    totalPrice += labour;
    breakdown.push({
      label: `Labour: ${crew} crew × ${hours} hr × ${fmtMoney(hr)}`,
      amount: labour,
    });
  }

  const plc = args.parkingLongCarryTotal ?? 0;
  if (plc > 0) {
    totalPrice += plc;
    breakdown.push({ label: "Parking / long carry", amount: plc });
  }

  for (const extra of args.pricingExtras ?? []) {
    const amt = Math.round(extra.amount * 100) / 100;
    if (amt > 0) {
      totalPrice += amt;
      breakdown.push({ label: extra.label, amount: amt });
    }
  }

  const volN = args.input.monthly_delivery_volume ?? 0;
  const volPct = volumeDiscountPercentForCount(volN, vc.volume_discount_tiers);
  if (dimOn && volN > 0 && volPct > 0) {
    const disc = Math.round(totalPrice * (volPct / 100) * 100) / 100;
    if (disc > 0) {
      totalPrice -= disc;
      breakdown.push({
        label: `Volume discount (${volPct}% at ${volN}+ deliveries/mo est.)`,
        amount: -disc,
      });
    }
  }

  const minCharge = num(vc.min_charge, num(args.vertical.base_rate, 0));
  if (totalPrice < minCharge) {
    const delta = minCharge - totalPrice;
    totalPrice = minCharge;
    breakdown.push({ label: "Minimum charge applied", amount: delta });
  }

  const roundN = Math.max(1, args.roundingNearest);
  const beforeRound = totalPrice;
  totalPrice = Math.round(totalPrice / roundN) * roundN;
  if (totalPrice !== beforeRound) {
    breakdown.push({ label: `Round to nearest ${fmtMoney(roundN)}`, amount: totalPrice - beforeRound });
  }

  if (totalPrice < 200) totalPrice = 200;

  let crew = args.input.crew_override ?? num(vc.min_crew, 2);
  const th = num(vc.large_job_item_threshold, 0);
  const lc = num(vc.large_job_min_crew, 0);
  if (args.input.crew_override == null && th > 0 && lc > 0 && totalUnits >= th) {
    crew = Math.max(crew, lc);
  }
  if (args.input.crew_override == null && (medicalNeedsThreeCrew || heavyItemNeedsThreeCrew)) {
    crew = Math.max(crew, 3);
  }
  const estimatedHours =
    args.input.estimated_hours_override ?? estimateB2BHours(args.input, vc);

  const truckLabel =
    truck === "sprinter"
      ? "Sprinter van"
      : truck.endsWith("ft")
        ? `${truck.replace("ft", "")} ft truck`
        : truck;
  const includes: string[] = [`${crew}-person crew`, truckLabel, args.vertical.name];
  if (args.input.handling_type) {
    includes.push(`${args.input.handling_type.replace(/_/g, " ")} handling`);
  }
  if (vc.auto_quote_disabled === true) {
    includes.push("Custom scope — coordinator finalizes price (specialty quote builder)");
  }
  const vd = vc.volume_discount_tiers;
  if (Array.isArray(vd) && vd.length > 0) {
    if (volN > 0 && volPct > 0) {
      includes.push(`Volume discount ${volPct}% applied (${volN}/mo est.)`);
    } else {
      includes.push("Volume discounts available for qualifying monthly delivery counts");
    }
  }

  return {
    subtotal: totalPrice,
    breakdown,
    includes,
    truck,
    crew,
    estimatedHours,
    totalDistanceKm: distKm,
    stopCount: totalStops,
  };
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })}`;
}
