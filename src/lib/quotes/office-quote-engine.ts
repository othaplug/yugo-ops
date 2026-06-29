/**
 * Office quote engine — turns the inventory-driven labour estimate into three
 * priced tiers (Essential / Signature / Priority). The commercial parallel to
 * calcResidential(), but the tiers diverge by SCOPE (who packs / unpacks / PM),
 * with every dollar derived from real inventory labour, not a flat multiplier.
 *
 * Price per tier =
 *     move labour   (handling + transport man-hours × MOVE_RATE)   — all tiers
 *   + pack labour   (IT or full pack + unpack man-hours × PACK_RATE)
 *   + trucks        (trucks × days × TRUCK_DAY_RATE)
 *   + supplies      (IT supplies on Signature, full supplies on Priority)
 *   + on-site PM    (Priority only: days × PM_DAY_RATE)
 *   + surcharges    (after-hours ×, weekend +, distance, access)
 *   then min floor + $50 rounding.
 *
 * CALIBRATION v1: the rate set below lands the Ataccama inventory on the price
 * anchors at base conditions: Essential $5,500 / Signature $6,500 / Priority
 * $8,000. All rates are overridable via the config arg (wired to platform_config
 * when this is connected to the live generate route).
 *
 * CONFIDENCE BAND: a sanity check, not a hard rule. Because office moves are
 * often PARTIAL (only selected items leave a large floor), $/sqft runs naturally
 * low and cannot be a lower bound for those jobs. So the band is asymmetric:
 *   - upper bound always applies (price too high for the footprint → review)
 *   - lower bound applies ONLY to full (non-partial) moves with a moving_sqft
 * The inventory remains the primary driver; the band only flags outliers for an
 * admin to custom-quote.
 */

import {
  OFFICE_TIER_DEFINITIONS,
  OFFICE_TIER_ORDER,
  type OfficeTierKey,
} from "@/lib/tiers/office-tier-definitions";
import type { OfficeLabourEstimate } from "@/lib/quotes/office-inventory-labour";

export interface OfficeQuoteContext {
  /** One-way drive distance (km). Beyond the free threshold bills per km. */
  distanceKm?: number;
  /** Evening / overnight access → labour multiplier. */
  afterHours?: boolean;
  /** Weekend access → flat surcharge. */
  weekend?: boolean;
  /** Total access surcharge for origin + destination (computed upstream). */
  accessSurcharge?: number;
  /** Estimated square footage ACTUALLY moving (preferred for the band). */
  movingSqft?: number | null;
  /** Full origin footprint — used only as an upper sanity bound. */
  totalOriginSqft?: number | null;
  /** Selected-items / partial move → suppresses the $/sqft lower bound. */
  partialMove?: boolean;
}

export interface OfficeQuoteConfig {
  moveRate?: number;
  packRate?: number;
  truckDayRate?: number;
  itSuppliesPerItem?: number;
  fullSuppliesPerUnit?: number;
  pmDayRate?: number;
  afterHoursMultiplier?: number;
  weekendSurcharge?: number;
  freeDistanceKm?: number;
  perKm?: number;
  taxRate?: number;
  depositPct?: number;
  minPrice?: number;
  rounding?: number;
  sqftBandLow?: number;
  sqftBandHigh?: number;
}

const DEFAULTS: Required<OfficeQuoteConfig> = {
  moveRate: 53.4,
  packRate: 36,
  truckDayRate: 350,
  itSuppliesPerItem: 21.5,
  fullSuppliesPerUnit: 2.0,
  pmDayRate: 300,
  afterHoursMultiplier: 1.2,
  weekendSurcharge: 200,
  freeDistanceKm: 40,
  perKm: 4,
  taxRate: 0.13,
  depositPct: 30,
  minPrice: 1500,
  rounding: 50,
  sqftBandLow: 4,
  sqftBandHigh: 10,
};

export interface OfficeTierBreakdown {
  moveLabour: number;
  packLabour: number;
  trucks: number;
  supplies: number;
  onsitePM: number;
  afterHoursAdj: number;
  weekendSurcharge: number;
  distanceSurcharge: number;
  accessSurcharge: number;
}

export interface OfficeTierPrice {
  key: OfficeTierKey;
  /** Pre-tax tier price (rounded). */
  price: number;
  deposit: number;
  tax: number;
  total: number;
  crew: number;
  trucks: number;
  days: number;
  breakdown: OfficeTierBreakdown;
}

export interface OfficeConfidence {
  level: "high" | "review";
  reason: string;
  pricePerSqft: number | null;
  bandLow: number;
  bandHigh: number;
}

export interface OfficeQuoteResult {
  tiers: Record<OfficeTierKey, OfficeTierPrice>;
  confidence: OfficeConfidence;
  factors: Record<string, unknown>;
}

const round = (n: number, step: number) => Math.round(n / step) * step;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function calcOfficeTiers(
  labour: OfficeLabourEstimate,
  ctx: OfficeQuoteContext = {},
  config: OfficeQuoteConfig = {},
): OfficeQuoteResult {
  const c = { ...DEFAULTS, ...config };

  const moveLabourManHours = labour.handlingManHours + labour.transportManHours;
  const distanceSurcharge =
    Math.max(0, (ctx.distanceKm ?? 0) - c.freeDistanceKm) * c.perKm;
  const weekendSurcharge = ctx.weekend ? c.weekendSurcharge : 0;
  const accessSurcharge = ctx.accessSurcharge ?? 0;

  const tiers = {} as Record<OfficeTierKey, OfficeTierPrice>;

  // First pass: compute the unfloored pre-tax price + per-tier
  // metadata for every tier. We need ALL three pricePre values before
  // we can decide whether to apply the minimum-price floor uplift,
  // otherwise per-tier Math.max(minPrice, ...) collapses the ladder
  // (all three tiers landing below minPrice clamp to identical prices
  // -- operator caught this on YG-30346 where a near-empty inventory
  // produced \$1,550 / \$1,550 / \$1,550 with the right rail looking
  // like the override editor had wiped tier differentiation).
  type Interim = {
    tier: OfficeTierKey;
    pricePre: number;
    crew: number;
    trucks: number;
    days: number;
    breakdown: OfficeTierBreakdown;
  };
  const interim: Interim[] = [];

  for (const tier of OFFICE_TIER_ORDER) {
    const def = OFFICE_TIER_DEFINITIONS[tier];
    const lt = labour.perTier[tier];
    const crew = Math.max(labour.crew, def.ops.crewMinimum);
    const trucks = labour.trucks;
    const days = lt.days;

    // Pack labour man-hours by scope.
    const packManHours =
      tier === "essential"
        ? 0
        : tier === "signature"
          ? labour.itPackManHours
          : labour.fullPackManHours + labour.fullUnpackManHours;

    // Labour (move + pack), with after-hours premium applied to labour only.
    const labourBase =
      moveLabourManHours * c.moveRate + packManHours * c.packRate;
    const afterHoursAdj = ctx.afterHours
      ? labourBase * (c.afterHoursMultiplier - 1)
      : 0;

    const moveLabour = r2(moveLabourManHours * c.moveRate);
    const packLabour = r2(packManHours * c.packRate);
    const trucksCost = trucks * days * c.truckDayRate;

    const supplies =
      tier === "essential"
        ? 0
        : tier === "signature"
          ? r2(labour.itItemCount * c.itSuppliesPerItem)
          : r2(labour.unitCount * c.fullSuppliesPerUnit);

    const onsitePM = def.ops.onsitePM ? days * c.pmDayRate : 0;

    const pricePre =
      labourBase +
      afterHoursAdj +
      trucksCost +
      supplies +
      onsitePM +
      weekendSurcharge +
      distanceSurcharge +
      accessSurcharge;

    interim.push({
      tier,
      pricePre,
      crew,
      trucks,
      days,
      breakdown: {
        moveLabour,
        packLabour,
        trucks: trucksCost,
        supplies,
        onsitePM,
        afterHoursAdj: r2(afterHoursAdj),
        weekendSurcharge,
        distanceSurcharge: r2(distanceSurcharge),
        accessSurcharge,
      },
    });
  }

  // Minimum-price floor uplift. If Essential (the cheapest tier) lands
  // below the floor, scale all three proportionally so Essential lifts
  // to minPrice and Signature/Priority preserve their relative
  // premium. Without this, a small office job ($500 / $700 / $1,200
  // computed) becomes $1,500 / $1,500 / $1,500 after the per-tier
  // Math.max -- which looks broken to operators and removes the
  // upsell.
  const essentialPre = interim[0]?.pricePre ?? 0;
  const floor = c.minPrice;
  const upliftScale =
    essentialPre > 0 && essentialPre < floor ? floor / essentialPre : 1;

  for (const r of interim) {
    const scaled = r.pricePre * upliftScale;
    // Belt-and-suspenders: still respect minPrice as the absolute
    // floor for every tier (in case Essential was already at $0 and
    // the scale didn't lift the higher tiers above floor).
    const price = Math.max(floor, round(scaled, c.rounding));
    const tax = Math.round(price * c.taxRate);
    const total = price + tax;
    const deposit = Math.round(price * (c.depositPct / 100));

    tiers[r.tier] = {
      key: r.tier,
      price,
      deposit,
      tax,
      total,
      crew: r.crew,
      trucks: r.trucks,
      days: r.days,
      breakdown: r.breakdown,
    };
  }

  // ── Confidence band (asymmetric, partial-move aware) ──
  const footprint = ctx.movingSqft ?? ctx.totalOriginSqft ?? null;
  const refPrice = tiers.priority.price; // full-service tier vs the footprint
  let confidence: OfficeConfidence;
  if (!footprint || footprint <= 0) {
    confidence = {
      level: "high",
      reason: "No square footage provided to cross-check against.",
      pricePerSqft: null,
      bandLow: c.sqftBandLow,
      bandHigh: c.sqftBandHigh,
    };
  } else {
    const pricePerSqft = r2(refPrice / footprint);
    if (pricePerSqft > c.sqftBandHigh) {
      confidence = {
        level: "review",
        reason: `Priority is $${pricePerSqft}/sqft, above the $${c.sqftBandHigh}/sqft benchmark — confirm the inventory and footprint.`,
        pricePerSqft,
        bandLow: c.sqftBandLow,
        bandHigh: c.sqftBandHigh,
      };
    } else if (
      !ctx.partialMove &&
      ctx.movingSqft &&
      pricePerSqft < c.sqftBandLow
    ) {
      confidence = {
        level: "review",
        reason: `Priority is $${pricePerSqft}/sqft, below the $${c.sqftBandLow}/sqft benchmark for a full move — the inventory may be light.`,
        pricePerSqft,
        bandLow: c.sqftBandLow,
        bandHigh: c.sqftBandHigh,
      };
    } else {
      confidence = {
        level: "high",
        reason: ctx.partialMove
          ? `Partial move — $${pricePerSqft}/sqft is expected to run below the full-move benchmark.`
          : `$${pricePerSqft}/sqft is within the expected band.`,
        pricePerSqft,
        bandLow: c.sqftBandLow,
        bandHigh: c.sqftBandHigh,
      };
    }
  }

  const factors = {
    office_pricing_model: "inventory_scope_tiered",
    office_labour_calibration_version: labour.calibrationVersion,
    office_volume_score: labour.volumeScore,
    office_crew: labour.crew,
    office_trucks: labour.trucks,
    office_unit_count: labour.unitCount,
    office_it_item_count: labour.itItemCount,
    office_move_labour_manhours: r2(moveLabourManHours),
    office_handling_manhours: labour.handlingManHours,
    office_transport_manhours: labour.transportManHours,
    office_it_pack_manhours: labour.itPackManHours,
    office_full_pack_manhours: labour.fullPackManHours,
    office_full_unpack_manhours: labour.fullUnpackManHours,
    office_per_tier_days: {
      essential: labour.perTier.essential.days,
      signature: labour.perTier.signature.days,
      priority: labour.perTier.priority.days,
    },
    office_after_hours: !!ctx.afterHours,
    office_weekend: !!ctx.weekend,
    office_distance_km: ctx.distanceKm ?? null,
    office_partial_move: !!ctx.partialMove,
    office_moving_sqft: ctx.movingSqft ?? null,
    office_total_origin_sqft: ctx.totalOriginSqft ?? null,
    office_confidence: confidence.level,
    office_rates: {
      move_rate: c.moveRate,
      pack_rate: c.packRate,
      truck_day_rate: c.truckDayRate,
      it_supplies_per_item: c.itSuppliesPerItem,
      full_supplies_per_unit: c.fullSuppliesPerUnit,
      pm_day_rate: c.pmDayRate,
    },
  };

  return { tiers, confidence, factors };
}
