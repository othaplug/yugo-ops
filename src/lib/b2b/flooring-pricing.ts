/**
 * Flat-band pricing for Flooring / Building Materials delivery.
 * Replaces the per-piece dimensional engine for this vertical.
 */

import type { B2BRateCard, FlooringZoneCounts, FlooringHandlingZoneRates } from "./rate-card-types";
import type { B2BZone } from "./zone-detector";

export type FlooringMaterial = "vinyl" | "hardwood" | "tile";
export type FlooringHandling = "curbside" | "inside";

export type FlooringPriceResult = {
  baseRate: number;
  addonsTotal: number;
  total: number;
  /** Pre-tax breakdown lines suitable for the pricing panel. */
  breakdown: { label: string; amount: number }[];
  /** The resolved 20-unit band (e.g. 40 for a 25-box order). */
  band: number;
  requiresCustomQuote: boolean;
};

type FlooringBandKey = "20" | "40" | "60" | "80" | "100";

/**
 * Round box count UP to the nearest 20-unit band.
 * Returns 0 when boxCount === 0 (empty order).
 */
function getFlooringBand(boxCount: number): number {
  if (boxCount <= 0) return 0;
  return Math.ceil(boxCount / 20) * 20;
}

export type FlooringPricingInput = {
  boxCount: number;
  material: FlooringMaterial;
  handling: FlooringHandling;
  zone: B2BZone;
  isPartner: boolean;
  addons: {
    stairsFlights?: number;
    longCarry?: boolean;
    weekend?: boolean;
  };
};

export function calcFlooringPrice(
  input: FlooringPricingInput,
  rateCard: B2BRateCard,
): FlooringPriceResult {
  const fail = (msg: string, band = 0): FlooringPriceResult => ({
    baseRate: 0,
    addonsTotal: 0,
    total: 0,
    breakdown: [{ label: msg, amount: 0 }],
    band,
    requiresCustomQuote: true,
  });

  if (input.zone === "custom") {
    return fail("Zone beyond 160 km — custom quote required");
  }

  const band = getFlooringBand(input.boxCount);
  if (band === 0) {
    return fail("Enter a box count to calculate flooring price");
  }
  if (band > 100) {
    return fail("Over 100 boxes — custom quote required", band);
  }

  const rateKey = input.isPartner
    ? (`partner_${input.handling}` as const)
    : (`standard_${input.handling}` as const);

  const materialRates = rateCard.flooring?.[input.material];
  if (!materialRates) {
    return fail("Material not found in rate card", band);
  }

  // Try the specific tier/zone first; fall back to standard handling for the same zone
  const rates = materialRates as Record<string, FlooringHandlingZoneRates | undefined>;
  const handlingZones: FlooringHandlingZoneRates | undefined =
    rates[rateKey] ?? rates[`standard_${input.handling}`];

  const zoneRates: FlooringZoneCounts | undefined =
    handlingZones?.[input.zone] ?? handlingZones?.["gta"];

  const bandKey = String(band) as FlooringBandKey;
  const baseRate = zoneRates?.[bandKey];

  if (!baseRate) {
    return fail(
      `No rate found for ${input.material} / ${input.handling} / ${input.zone} / ${band} boxes`,
      band,
    );
  }

  const breakdown: { label: string; amount: number }[] = [
    {
      label: `${input.boxCount} box${input.boxCount !== 1 ? "es" : ""} → ${band}-unit band · ${input.material} · ${input.handling} · ${input.zone.replace(/_/g, " ")}${input.isPartner ? " · partner" : ""}`,
      amount: baseRate,
    },
  ];

  let addonsTotal = 0;
  const a = input.addons;
  const blocksOf20 = Math.ceil(input.boxCount / 20);

  if (a.stairsFlights && a.stairsFlights > 0) {
    const charge = a.stairsFlights * 25 * blocksOf20;
    addonsTotal += charge;
    breakdown.push({
      label: `Stairs: ${a.stairsFlights} flight${a.stairsFlights !== 1 ? "s" : ""} × ${blocksOf20} block${blocksOf20 !== 1 ? "s" : ""} of 20`,
      amount: charge,
    });
  }

  if (a.longCarry) {
    const charge = blocksOf20 * 35;
    addonsTotal += charge;
    breakdown.push({
      label: `Long carry (>50 m): ${blocksOf20} block${blocksOf20 !== 1 ? "s" : ""} × $35`,
      amount: charge,
    });
  }

  if (a.weekend) {
    const charge = Math.round(baseRate * 0.1);
    addonsTotal += charge;
    breakdown.push({ label: "Weekend / evening (+10%)", amount: charge });
  }

  return {
    baseRate,
    addonsTotal,
    total: baseRate + addonsTotal,
    breakdown,
    band,
    requiresCustomQuote: false,
  };
}
