/**
 * Outbound staging pricing.
 *
 * Yugo gets paid for: pickup at the consignor + transport to warehouse +
 * intake + palletization + (optional) hold-days beyond the included grace
 * window + (optional) declared-value handling for high-value items.
 *
 * Designed against the Logistic GRshop / Blu Dot 2026-06-16 request:
 *   • 1 residential pickup (Toronto)
 *   • 3 items, 1 oversize dining table needing palletization (48"x48"x29",
 *     215 lb)
 *   • Declared value CAD $4,524
 *   • Hand off to a 3rd-party freight carrier from Yugo's warehouse
 *
 * Designed to be inspectable: every line item is broken out so a partner can
 * see exactly what they're paying for. No hidden charges, no mystery margin.
 *
 * Real, not superficial:
 *   • The base fee covers the pickup truck day (already part of Yugo's
 *     fixed overhead — direct cost is fuel + crew labor).
 *   • Palletization is priced per pallet (one or two-pallet jobs are common).
 *   • Hold days are billed PER DAY beyond the grace window (3 days free),
 *     not a flat fee — partners pay only for the time they actually consume.
 *   • Declared value is 1% of the declared CAD, capped at $150 — covers
 *     cargo-insurance trust contribution without doubling the partner's
 *     freight insurance.
 *
 * All amounts CAD, pre-tax. HST is applied by the caller.
 */

export type OutboundStagingPricingInputs = {
  /** Drive distance one-way from the warehouse to the consignor, km. */
  pickupDistanceKm: number;
  /** Number of pallets to build at warehouse (1 minimum). */
  palletCount: number;
  /** Declared CAD value across all items (for cargo-insurance contribution). */
  declaredValue: number;
  /** Hold days requested or expected beyond the free grace window. */
  expectedHoldDays?: number;
  /** Does the partner want light crating beyond shrink-wrap pallet? */
  cratingRequired?: boolean;
  /** Is the pickup outside Yugo's standard service zone? Adds zone surcharge. */
  outsideStandardZone?: boolean;
};

export type OutboundStagingLineItem = {
  key: string;
  label: string;
  amount: number;
  detail?: string;
};

export type OutboundStagingPricingResult = {
  lines: OutboundStagingLineItem[];
  subtotal: number;
  hst: number;
  total: number;
  inputs: OutboundStagingPricingInputs;
  /** Days included free in the base; partner pays from day N+1. */
  freeHoldDays: number;
  pricePerHoldDay: number;
  palletizationPerPallet: number;
};

/** Constants kept here so they're one search away. Adjust as policy evolves. */
export const OUTBOUND_STAGING_BASE_FEE = 275;
export const OUTBOUND_STAGING_PICKUP_RATE_PER_KM = 2.5;
export const OUTBOUND_STAGING_PICKUP_MIN = 60;
export const OUTBOUND_STAGING_PALLETIZATION_PER_PALLET = 145;
export const OUTBOUND_STAGING_CRATING_FLAT = 95;
export const OUTBOUND_STAGING_HOLD_FREE_DAYS = 3;
export const OUTBOUND_STAGING_HOLD_PER_DAY = 18;
export const OUTBOUND_STAGING_DECLARED_VALUE_RATE = 0.01;
export const OUTBOUND_STAGING_DECLARED_VALUE_CAP = 150;
export const OUTBOUND_STAGING_OUT_OF_ZONE_SURCHARGE = 85;
export const OUTBOUND_STAGING_HST_RATE = 0.13;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute pricing for an outbound staging shipment.
 *
 * Returns a fully-itemised quote with HST applied. Caller decides whether
 * to surface the breakdown to the partner or just the totals.
 */
export function priceOutboundStagingShipment(
  inputs: OutboundStagingPricingInputs,
): OutboundStagingPricingResult {
  const pickupDistanceKm = Math.max(0, Number(inputs.pickupDistanceKm) || 0);
  const palletCount = Math.max(1, Math.floor(Number(inputs.palletCount) || 1));
  const declaredValue = Math.max(0, Number(inputs.declaredValue) || 0);
  const expectedHoldDays = Math.max(0, Math.floor(Number(inputs.expectedHoldDays) || 0));
  const cratingRequired = !!inputs.cratingRequired;
  const outsideStandardZone = !!inputs.outsideStandardZone;

  const lines: OutboundStagingLineItem[] = [];

  // 1) Base intake & handling — single non-negotiable line that covers crew,
  //    warehouse intake, photo documentation, and admin paperwork.
  lines.push({
    key: "base",
    label: "Pickup, intake & warehouse handling",
    amount: OUTBOUND_STAGING_BASE_FEE,
    detail: "Crew, scheduling, photo documentation, intake processing",
  });

  // 2) Pickup distance — billed beyond a min so a 0.5 km pickup doesn't
  //    show as $1.25 (looks unprofessional + drives down to fuel costs).
  const rawPickupDistance = pickupDistanceKm * OUTBOUND_STAGING_PICKUP_RATE_PER_KM;
  const pickupCharge = round2(Math.max(OUTBOUND_STAGING_PICKUP_MIN, rawPickupDistance));
  lines.push({
    key: "pickup_distance",
    label: "Pickup distance",
    amount: pickupCharge,
    detail: `${pickupDistanceKm.toFixed(1)} km · $${OUTBOUND_STAGING_PICKUP_RATE_PER_KM.toFixed(2)}/km (min $${OUTBOUND_STAGING_PICKUP_MIN})`,
  });

  // 3) Palletization — per pallet built at the warehouse.
  const palletizationCharge = round2(
    palletCount * OUTBOUND_STAGING_PALLETIZATION_PER_PALLET,
  );
  lines.push({
    key: "palletization",
    label: "Palletization",
    amount: palletizationCharge,
    detail: `${palletCount} pallet${palletCount === 1 ? "" : "s"} · $${OUTBOUND_STAGING_PALLETIZATION_PER_PALLET}/pallet`,
  });

  // 4) Optional crating — flat for jobs where shrink-wrap isn't enough.
  if (cratingRequired) {
    lines.push({
      key: "crating",
      label: "Protective crating",
      amount: OUTBOUND_STAGING_CRATING_FLAT,
      detail: "Custom corner-protected crating",
    });
  }

  // 5) Hold days — billed PER DAY beyond the grace window. We always show
  //    the line so the partner sees the policy, even when amount is 0.
  const billableHoldDays = Math.max(
    0,
    expectedHoldDays - OUTBOUND_STAGING_HOLD_FREE_DAYS,
  );
  const holdCharge = round2(billableHoldDays * OUTBOUND_STAGING_HOLD_PER_DAY);
  lines.push({
    key: "hold_days",
    label: "Warehouse hold",
    amount: holdCharge,
    detail:
      expectedHoldDays === 0
        ? `First ${OUTBOUND_STAGING_HOLD_FREE_DAYS} days included`
        : billableHoldDays === 0
          ? `${expectedHoldDays} day${expectedHoldDays === 1 ? "" : "s"} requested · within ${OUTBOUND_STAGING_HOLD_FREE_DAYS}-day grace`
          : `${expectedHoldDays} days · ${OUTBOUND_STAGING_HOLD_FREE_DAYS} free · ${billableHoldDays} billed @ $${OUTBOUND_STAGING_HOLD_PER_DAY}/day`,
  });

  // 6) Declared value handling — 1% capped at $150. Only show if non-zero.
  const declaredFee = round2(
    Math.min(
      OUTBOUND_STAGING_DECLARED_VALUE_CAP,
      declaredValue * OUTBOUND_STAGING_DECLARED_VALUE_RATE,
    ),
  );
  if (declaredFee > 0) {
    lines.push({
      key: "declared_value_fee",
      label: "Declared value handling",
      amount: declaredFee,
      detail: `1% of $${declaredValue.toFixed(2)} declared · capped at $${OUTBOUND_STAGING_DECLARED_VALUE_CAP}`,
    });
  }

  // 7) Out-of-zone surcharge — only if applicable.
  if (outsideStandardZone) {
    lines.push({
      key: "out_of_zone",
      label: "Outside standard zone",
      amount: OUTBOUND_STAGING_OUT_OF_ZONE_SURCHARGE,
      detail: "Pickup outside the standard service area",
    });
  }

  const subtotal = round2(lines.reduce((sum, line) => sum + line.amount, 0));
  const hst = round2(subtotal * OUTBOUND_STAGING_HST_RATE);
  const total = round2(subtotal + hst);

  return {
    lines,
    subtotal,
    hst,
    total,
    inputs: {
      pickupDistanceKm,
      palletCount,
      declaredValue,
      expectedHoldDays,
      cratingRequired,
      outsideStandardZone,
    },
    freeHoldDays: OUTBOUND_STAGING_HOLD_FREE_DAYS,
    pricePerHoldDay: OUTBOUND_STAGING_HOLD_PER_DAY,
    palletizationPerPallet: OUTBOUND_STAGING_PALLETIZATION_PER_PALLET,
  };
}
