/**
 * Cabinetry & Fixtures flat-band pricer — the single source of truth for
 * cabinetry delivery pricing. BOTH the admin price-preview route and
 * /api/quotes/generate call this, so the previewed price and the saved/sent
 * quote can never diverge (the "two engines" bug: preview used one path while
 * generate ran the old per-piece dimensional engine, over-quoting a normal
 * kitchen past $1,600).
 *
 * Model (operator-approved 2026-08, replaces the per-piece dimensional engine
 * for cabinetry):
 *   - Score the load in CABINET-UNITS, not raw pieces. A carcass = 1.0 unit,
 *     loose parts (shelves, doors, filler, toe-kick, crown, small panels) score
 *     0.2 (5 loose = 1 unit), and ride-along hardware boxes score 0.0. This is
 *     what stops a 20-shelf box from billing like 20 cabinets.
 *   - Base covers the first N units (default 8) + pickup + delivery + first
 *     ~20 km + threshold (dock/door) drop. This base is also the floor.
 *   - Each additional cabinet-unit beyond the included count adds a flat rate.
 *   - Handling tiers actually earn a premium: threshold (included),
 *     room-of-choice (+flat), white glove (+% with a floor).
 *   - Extra pickup stops add one unified per-stop fee (replaces the old
 *     $55 engine charge + $75 route charge double-bill).
 *   - Zone is straight-line distance from the office to the DELIVERY point
 *     (furthest drop), not total multi-stop route km.
 *   - Truck + crew are sized from the weighted unit count for ops/dispatch;
 *     they do NOT add a separate charge (folded into the model).
 *
 * All dollar knobs are config-driven via the `b2b_cabinetry_rate` JSON in
 * platform_config, with the defaults below as the seeded values.
 */

import { applyProcessingRecoveryAndRound } from "./processing-recovery";
import { getZoneFromDistance, type B2BZone } from "@/lib/b2b/zone-detector";

/** Platform-config, as either a Map or a plain object (both call shapes). */
type ConfigLike =
  | Map<string, string>
  | Record<string, string | number | null | undefined>;

function cfgGet(config: ConfigLike, key: string): string | undefined {
  const v = config instanceof Map ? config.get(key) : config[key];
  return v === undefined || v === null ? undefined : String(v);
}

export type CabinetryFlatBandLine = {
  description?: string;
  quantity: number;
  /** light | medium | heavy | extra_heavy — drives truck sizing + heavy fees. */
  weight_category?: string;
  /** Catalog slug / unit type from the quick-add catalog, if known. */
  unit_type?: string;
  /** Declared value string, triggers a flat insurance fee when present. */
  declared_value?: string;
};

export type CabinetryFlatBandInput = {
  lines: CabinetryFlatBandLine[];
  /** Straight-line km from the office to the delivery (furthest) point. */
  deliveryKmFromOffice: number;
  /** Extra PICKUP stops beyond the first (the first pickup is included). */
  extraPickupStops: number;
  /** curbside | threshold | room_of_choice | white_glove */
  handlingType: string;
  isPartner: boolean;
  weekend: boolean;
  longCarry: boolean;
  stairsFlights: number;
};

export type CabinetryFlatBandResult = {
  ok: boolean;
  requiresCustomQuote: boolean;
  /** Raw line-item piece count (Σ quantity) — for display only. */
  rawPieceCount: number;
  /** Weighted cabinet-units the price is actually built on. */
  weightedUnits: number;
  zone: B2BZone;
  /** Pre-recovery, pre-round subtotal. */
  subtotalPreRound: number;
  /** Recovery-inclusive, rounded pre-tax price (what the client is quoted). */
  roundedPreTax: number;
  breakdown: { label: string; amount: number }[];
  truck: string;
  crew: number;
  includes: string[];
};

type CabinetryRateConfig = {
  base_rate: number;
  units_included_in_base: number;
  per_unit_rate: number;
  extra_pickup_stop_fee: number;
  /** Zone uplifts added to the base for delivery beyond the GTA core. */
  zone_uplift: { extended_gta: number; regional_ontario: number };
  /** Handling premiums. white_glove is a percentage with a dollar floor. */
  handling: {
    curbside: number;
    threshold: number;
    room_of_choice: number;
    white_glove_pct: number;
    white_glove_min: number;
  };
  /** Per-unit add-on rates. */
  long_carry_per_2_units: number;
  stairs_per_flight_per_5_units: number;
  weekend_pct: number;
  /** Above this weighted-unit count, fall back to a custom quote. */
  custom_quote_over_units: number;
};

const DEFAULTS: CabinetryRateConfig = {
  base_rate: 450,
  units_included_in_base: 8,
  per_unit_rate: 22,
  extra_pickup_stop_fee: 65,
  zone_uplift: { extended_gta: 75, regional_ontario: 150 },
  handling: {
    curbside: 0,
    threshold: 0,
    room_of_choice: 150,
    white_glove_pct: 0.3,
    white_glove_min: 200,
  },
  long_carry_per_2_units: 35,
  stairs_per_flight_per_5_units: 35,
  weekend_pct: 0.1,
  custom_quote_over_units: 60,
};

function loadRateConfig(config: ConfigLike): CabinetryRateConfig {
  try {
    const raw = cfgGet(config, "b2b_cabinetry_rate");
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<CabinetryRateConfig>;
    return {
      ...DEFAULTS,
      ...parsed,
      zone_uplift: { ...DEFAULTS.zone_uplift, ...(parsed.zone_uplift ?? {}) },
      handling: { ...DEFAULTS.handling, ...(parsed.handling ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

/**
 * Count factor for a single cabinetry line. Structural carcasses score a full
 * unit; loose parts a fifth; ride-along hardware nothing. Unknown items default
 * to a full unit so we never silently undercount a real carcass.
 */
export function cabinetCountFactor(line: CabinetryFlatBandLine): number {
  const hay = `${line.unit_type ?? ""} ${line.description ?? ""}`.toLowerCase();
  const has = (kw: string) => hay.includes(kw);

  // Ride-along hardware — 0.0 units (rides free with the load).
  if (
    ["hardware", "hinge", "knob", "screw", "fastener", "leveler", "leveller", "assembly kit"].some(has) ||
    /\blegs?\b/.test(hay)
  ) {
    return 0.0;
  }

  // Loose parts: 5 = 1 unit — 0.2 each. Note "large end / gable panels" are
  // structural (fall through to 1.0); only small/filler panels score here.
  if (
    [
      "shelf",
      "shelves",
      "door",
      "drawer front",
      "drawer box",
      "filler",
      "toe-kick",
      "toe kick",
      "toekick",
      "crown",
      "moulding",
      "molding",
      "light rail",
      "trim",
      "glass insert",
      "small panel",
      "panel strip",
    ].some(has)
  ) {
    return 0.2;
  }

  // Everything else (base/lower, upper/wall, tall/pantry, vanity, island, sink
  // base, corner, large end/gable panel, countertop slab, or anything
  // unrecognised) is a full cabinet-unit.
  return 1.0;
}

function normalizeHandling(
  handlingType: string,
): "curbside" | "threshold" | "room_of_choice" | "white_glove" {
  const h = (handlingType || "threshold").toLowerCase();
  if (h === "curbside" || h === "dock" || h === "garage") return "curbside";
  if (
    h === "room_of_choice" ||
    h === "room-of-choice" ||
    h === "inside" ||
    h === "room_placement"
  ) {
    return "room_of_choice";
  }
  if (h === "white_glove" || h === "white-glove" || h === "install") {
    return "white_glove";
  }
  return "threshold";
}

function recommendTruckAndCrew(
  weightedUnits: number,
  extraHeavyCount: number,
): { truck: string; crew: number } {
  let sizeIdx: number;
  if (weightedUnits <= 5) sizeIdx = 0; // sprinter
  else if (weightedUnits <= 12) sizeIdx = 1; // 16ft
  else if (weightedUnits <= 20) sizeIdx = 2; // 20ft
  else sizeIdx = 3; // 26ft
  // Never put stone slabs / islands / base runs in a sprinter, even on a small
  // count. Weight only affects the truck and crew, never the price.
  if (extraHeavyCount >= 1 && sizeIdx === 0) sizeIdx = 1;
  const trucks = ["sprinter", "16ft", "20ft", "26ft"];

  let crew = 2;
  if (weightedUnits > 20) crew = 4;
  else if (weightedUnits > 10) crew = 3;
  if (extraHeavyCount >= 2 && crew < 3) crew = 3;

  return { truck: trucks[sizeIdx], crew };
}

/**
 * Price a cabinetry delivery. Recovery-inclusive rounded price is
 * `result.roundedPreTax`; callers apply tax on top of it.
 */
export function priceCabinetryFlatBand(
  input: CabinetryFlatBandInput,
  config: ConfigLike,
): CabinetryFlatBandResult {
  const rc = loadRateConfig(config);
  const zone = getZoneFromDistance(input.deliveryKmFromOffice ?? 0);

  const rawPieceCount = input.lines.reduce(
    (s, l) => s + Math.max(0, Number(l.quantity) || 0),
    0,
  );
  const weightedRaw = input.lines.reduce(
    (s, l) => s + Math.max(0, Number(l.quantity) || 0) * cabinetCountFactor(l),
    0,
  );
  // Round to a whole cabinet-unit, floor at 1 so an empty/loose-only load still
  // carries the base.
  const weightedUnits = Math.max(1, Math.round(weightedRaw));

  // Weight class is used ONLY to size the truck + crew, never to surcharge the
  // price (a kitchen of cabinets is uniformly heavy; the count-unit already
  // prices the load).
  const extraHeavyCount = input.lines.reduce((s, l) => {
    const wc = (l.weight_category ?? "").toLowerCase();
    return s + (wc === "extra_heavy" || wc === "very_heavy" ? Math.max(1, l.quantity) : 0);
  }, 0);

  const breakdown: { label: string; amount: number }[] = [];

  if (zone === "custom" || weightedUnits > rc.custom_quote_over_units) {
    return {
      ok: false,
      requiresCustomQuote: true,
      rawPieceCount,
      weightedUnits,
      zone,
      subtotalPreRound: 0,
      roundedPreTax: 0,
      breakdown: [
        {
          label:
            zone === "custom"
              ? "Delivery beyond 160 km, custom quote required"
              : `${weightedUnits} cabinet-units exceeds standard band, custom quote required`,
          amount: 0,
        },
      ],
      truck: "26ft",
      crew: 4,
      includes: [],
    };
  }

  // ── Base + per-unit ────────────────────────────────────────────────────────
  const extraUnits = Math.max(0, weightedUnits - rc.units_included_in_base);
  const perUnitTotal = extraUnits * rc.per_unit_rate;
  let base = rc.base_rate + perUnitTotal;
  breakdown.push({
    label: `Cabinetry delivery, ${weightedUnits} cabinet-unit${weightedUnits !== 1 ? "s" : ""} (${rc.units_included_in_base} included)`,
    amount: rc.base_rate,
  });
  if (perUnitTotal > 0) {
    breakdown.push({
      label: `Additional cabinet-units (${extraUnits} × $${rc.per_unit_rate})`,
      amount: perUnitTotal,
    });
  }

  // ── Zone uplift (delivery point straight-line from office) ─────────────────
  let zoneUplift = 0;
  if (zone === "extended_gta") zoneUplift = rc.zone_uplift.extended_gta;
  else if (zone === "regional_ontario") zoneUplift = rc.zone_uplift.regional_ontario;
  if (zoneUplift > 0) {
    base += zoneUplift;
    breakdown.push({
      label: `Extended zone (${zone.replace(/_/g, " ")})`,
      amount: zoneUplift,
    });
  }

  // ── Handling premium ───────────────────────────────────────────────────────
  const handling = normalizeHandling(input.handlingType);
  if (handling === "room_of_choice" && rc.handling.room_of_choice > 0) {
    base += rc.handling.room_of_choice;
    breakdown.push({
      label: "Room-of-choice placement",
      amount: rc.handling.room_of_choice,
    });
  } else if (handling === "white_glove") {
    const pct = Math.round(base * rc.handling.white_glove_pct);
    const wg = Math.max(pct, rc.handling.white_glove_min);
    base += wg;
    breakdown.push({
      label: `White glove (unpack, place, protect) +${Math.round(rc.handling.white_glove_pct * 100)}%`,
      amount: wg,
    });
  }

  // ── Extra pickup stops (unified fee, first pickup included) ─────────────────
  let addonsTotal = 0;
  const extraStops = Math.max(0, Math.floor(input.extraPickupStops || 0));
  if (extraStops > 0 && rc.extra_pickup_stop_fee > 0) {
    const charge = extraStops * rc.extra_pickup_stop_fee;
    addonsTotal += charge;
    breakdown.push({
      label: `Additional pickup stop${extraStops !== 1 ? "s" : ""} (${extraStops} × $${rc.extra_pickup_stop_fee})`,
      amount: charge,
    });
  }

  // ── Access add-ons ─────────────────────────────────────────────────────────
  if (input.longCarry && rc.long_carry_per_2_units > 0) {
    const charge = Math.ceil(weightedUnits / 2) * rc.long_carry_per_2_units;
    addonsTotal += charge;
    breakdown.push({ label: "Long carry (>50 m)", amount: charge });
  }
  if (input.stairsFlights > 0 && rc.stairs_per_flight_per_5_units > 0) {
    const setsOf5 = Math.ceil(weightedUnits / 5);
    const charge = input.stairsFlights * rc.stairs_per_flight_per_5_units * setsOf5;
    addonsTotal += charge;
    breakdown.push({
      label: `Stairs (${input.stairsFlights} flight${input.stairsFlights !== 1 ? "s" : ""} × ${setsOf5} set${setsOf5 !== 1 ? "s" : ""} of 5)`,
      amount: charge,
    });
  }
  if (input.weekend && rc.weekend_pct > 0) {
    const charge = Math.round(base * rc.weekend_pct);
    addonsTotal += charge;
    breakdown.push({ label: "Weekend / evening", amount: charge });
  }

  const subtotalPreRound = base + addonsTotal;
  const roundedPreTax = applyProcessingRecoveryAndRound(subtotalPreRound, config, 50);

  const { truck, crew } = recommendTruckAndCrew(weightedUnits, extraHeavyCount);

  const includes = [
    `${weightedUnits} cabinet-unit${weightedUnits !== 1 ? "s" : ""}`,
    zone.replace(/_/g, " "),
    handling.replace(/_/g, " "),
    input.isPartner ? "partner rate" : "standard rate",
  ];

  return {
    ok: true,
    requiresCustomQuote: false,
    rawPieceCount,
    weightedUnits,
    zone,
    subtotalPreRound,
    roundedPreTax,
    breakdown,
    truck,
    crew,
    includes,
  };
}
