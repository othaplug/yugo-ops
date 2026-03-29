/**
 * Universal B2B / logistics dimensional pricing (vertical config from DB).
 * Distance is supplied by caller (Mapbox multi-stop or point-to-point).
 */

export type B2BWeightCategory = "light" | "medium" | "heavy" | "extra_heavy";

export interface B2BQuoteLineItem {
  description: string;
  quantity: number;
  weight_category?: B2BWeightCategory;
  fragile?: boolean;
  dimensions?: string;
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

export function recommendTruckForB2B(_items: B2BQuoteLineItem[], totalUnits: number): string {
  if (totalUnits <= 5) return "sprinter";
  if (totalUnits <= 20) return "16ft";
  if (totalUnits <= 80) return "20ft";
  return "26ft";
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

export function lineItemsFromQuotePayload(input: {
  b2b_line_items?: B2BQuoteLineItem[];
  b2b_items?: string[];
  b2b_weight_category?: string;
}): B2BQuoteLineItem[] {
  if (input.b2b_line_items && input.b2b_line_items.length > 0) {
    const wc = mapLegacyWeightCategory(input.b2b_weight_category);
    return input.b2b_line_items.map((i) => ({
      ...i,
      quantity: Math.max(1, i.quantity || 1),
      weight_category: i.weight_category ?? wc,
    }));
  }
  if (input.b2b_items && input.b2b_items.length > 0) {
    const parsed = parseLegacyB2bItemStrings(input.b2b_items);
    const wc = mapLegacyWeightCategory(input.b2b_weight_category);
    return parsed.map((p) => ({ ...p, weight_category: wc }));
  }
  return [{ description: "Delivery", quantity: 1, weight_category: mapLegacyWeightCategory(input.b2b_weight_category) }];
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

export function calculateB2BDimensionalPrice(args: {
  vertical: DeliveryVerticalRow;
  mergedRates: Record<string, unknown>;
  input: B2BDimensionalQuoteInput;
  totalDistanceKm: number;
  roundingNearest: number;
  parkingLongCarryTotal?: number;
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

  const unitLabel = str(vc.unit_label, "item");
  const unitRate = num(vc.unit_rate, 0);

  const dimOn = method !== "flat" && method !== "hourly";
  const includeUnits = dimOn;
  if (includeUnits && unitRate > 0 && totalUnits > 0) {
    const unitCharge = Math.round(totalUnits * unitRate * 100) / 100;
    totalPrice += unitCharge;
    breakdown.push({
      label: `${totalUnits} ${unitLabel}(s) × ${fmtMoney(unitRate)}`,
      amount: unitCharge,
    });
  }

  const handlingRates = (vc.handling_rates as Record<string, number> | undefined) || {};
  const ht = args.input.handling_type || "threshold";
  let handlingCharge = 0;

  const perBoxKeys: { key: string; label: string; rateKey: string }[] = [
    { key: "hand_bomb", label: "Hand-bomb", rateKey: "hand_bomb_per_box" },
    { key: "carry_in", label: "Carry-in", rateKey: "carry_in_per_box" },
    { key: "room_placement", label: "Room placement", rateKey: "room_placement" },
  ];
  let handledPerBox = false;
  if (dimOn) {
    for (const row of perBoxKeys) {
      if (ht === row.key && handlingRates[row.rateKey] != null) {
        const r = num(handlingRates[row.rateKey], 0);
        handlingCharge = Math.round(totalUnits * r * 100) / 100;
        breakdown.push({
          label: `${row.label}: ${totalUnits} × ${fmtMoney(r)}`,
          amount: handlingCharge,
        });
        handledPerBox = true;
        break;
      }
    }
  }

  if (!handledPerBox && dimOn) {
    const raw = handlingRates[ht];
    if (typeof raw === "number" && raw > 0) {
      if (raw < 10 && ht === "hand_bomb") {
        handlingCharge = Math.round(totalUnits * raw * 100) / 100;
        breakdown.push({
          label: `Hand-bomb: ${totalUnits} × ${fmtMoney(raw)}`,
          amount: handlingCharge,
        });
      } else {
        handlingCharge = raw;
        breakdown.push({
          label: `${ht.replace(/_/g, " ")} handling`,
          amount: handlingCharge,
        });
      }
    }
  }
  totalPrice += handlingCharge;

  const weightTiers = vc.weight_tiers as Record<string, number> | undefined;
  if (weightTiers && dimOn) {
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

  const stops = args.input.stops.filter((s) => s.address.trim().length > 0);
  const totalStops = Math.max(stops.length, 2);
  const freeStops = num(vc.free_stops, 1);
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

  const recommendedTruck = recommendTruckForB2B(items, totalUnits);
  const truck = (args.input.truck_override || recommendedTruck).toLowerCase().replace(/\s+/g, "");
  const truckRates = (vc.truck_rates as Record<string, number> | undefined) || {};
  const truckSurcharge = num(truckRates[truck], 0);
  if (truckSurcharge > 0 && method !== "flat") {
    totalPrice += truckSurcharge;
    breakdown.push({ label: `${truck} truck`, amount: truckSurcharge });
  }

  const distKm = Math.max(0, args.totalDistanceKm);
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

  if (dimOn) {
    applyPremium("time_sensitive", !!args.input.time_sensitive);
    applyPremium("assembly_required", !!args.input.assembly_required);
    applyPremium("debris_removal", !!args.input.debris_removal);

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
      applyPremium(key, true);
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

  const crew = args.input.crew_override ?? num(vc.min_crew, 2);
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
