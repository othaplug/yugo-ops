/**
 * Flat-band pricing for Cabinetry & Fixtures and Appliance Delivery.
 * Replaces the per-piece dimensional engine for these two verticals.
 */

import type { B2BRateCard, B2BZoneRates, ApplianceZoneRates } from "./rate-card-types";
import type { B2BZone } from "./zone-detector";

export type CabinetPriceResult = {
  baseRate: number;
  addonsTotal: number;
  total: number;
  /** Pre-tax breakdown lines suitable for the pricing panel. */
  breakdown: { label: string; amount: number }[];
  requiresCustomQuote: boolean;
};

type BandKey = "1-5" | "6-10" | "11-15" | "16-20" | "21-25" | "26-30";

function getCabinetBand(qty: number): BandKey | "custom" {
  if (qty <= 5) return "1-5";
  if (qty <= 10) return "6-10";
  if (qty <= 15) return "11-15";
  if (qty <= 20) return "16-20";
  if (qty <= 25) return "21-25";
  if (qty <= 30) return "26-30";
  return "custom";
}

type ApplianceBandKey = "1-5" | "6-10" | "11-15" | "16-20";

function getApplianceBand(qty: number): ApplianceBandKey | "custom" {
  if (qty <= 5) return "1-5";
  if (qty <= 10) return "6-10";
  if (qty <= 15) return "11-15";
  if (qty <= 20) return "16-20";
  return "custom";
}

export type CabinetPricingInput = {
  /** Total piece count (sum of all line items). */
  pieceCount: number;
  zone: B2BZone;
  isPartner: boolean;
  addons: {
    longCarry?: boolean;
    stairsFlights?: number;
    weekend?: boolean;
    /** Number of items weighing 200–300 lbs. */
    heavyItemCount?: number;
    /** Number of items weighing 301–400 lbs. */
    overweightItemCount?: number;
    /** Declared value for insurance; triggers flat insurance fee. */
    insuranceDeclaredValue?: number;
  };
};

export function calcCabinetPrice(
  input: CabinetPricingInput,
  rateCard: B2BRateCard,
): CabinetPriceResult {
  const fail = (msg: string): CabinetPriceResult => ({
    baseRate: 0,
    addonsTotal: 0,
    total: 0,
    breakdown: [{ label: msg, amount: 0 }],
    requiresCustomQuote: true,
  });

  if (input.zone === "custom") {
    return fail("Zone beyond 160 km — custom quote required");
  }

  const band = getCabinetBand(input.pieceCount);
  if (band === "custom") {
    return fail("Over 30 pieces — custom quote required");
  }

  const rateType = input.isPartner ? "partner" : "standard";
  const zoneRates = rateCard.cabinets?.[rateType]?.[input.zone] as
    | B2BZoneRates
    | undefined;
  const baseRate = zoneRates?.[band];

  if (!baseRate) {
    return fail("Rate lookup failed — check rate card configuration");
  }

  const breakdown: { label: string; amount: number }[] = [
    {
      label: `${input.pieceCount} piece${input.pieceCount !== 1 ? "s" : ""} (${band} band) · ${input.zone.replace(/_/g, " ")} · ${rateType}`,
      amount: baseRate,
    },
  ];

  let addonsTotal = 0;
  const a = input.addons;

  if (a.longCarry) {
    const charge = Math.ceil(input.pieceCount / 2) * 35;
    addonsTotal += charge;
    breakdown.push({ label: "Long carry (>50 m)", amount: charge });
  }

  if (a.stairsFlights && a.stairsFlights > 0) {
    const setsOf5 = Math.ceil(input.pieceCount / 5);
    const charge = a.stairsFlights * 35 * setsOf5;
    addonsTotal += charge;
    breakdown.push({
      label: `Stairs: ${a.stairsFlights} flight${a.stairsFlights !== 1 ? "s" : ""} × ${setsOf5} set${setsOf5 !== 1 ? "s" : ""} of 5`,
      amount: charge,
    });
  }

  if (a.weekend) {
    const charge = Math.round(baseRate * 0.1);
    addonsTotal += charge;
    breakdown.push({ label: "Weekend / evening (+10%)", amount: charge });
  }

  if (a.heavyItemCount && a.heavyItemCount > 0) {
    const charge = a.heavyItemCount * 85;
    addonsTotal += charge;
    breakdown.push({
      label: `Heavy items (${a.heavyItemCount} × $85, 200–300 lbs)`,
      amount: charge,
    });
  }

  if (a.overweightItemCount && a.overweightItemCount > 0) {
    const charge = a.overweightItemCount * 150;
    addonsTotal += charge;
    breakdown.push({
      label: `Overweight items (${a.overweightItemCount} × $150, 301–400 lbs)`,
      amount: charge,
    });
  }

  if (a.insuranceDeclaredValue && a.insuranceDeclaredValue > 0) {
    const charge =
      input.pieceCount <= 5
        ? 50
        : input.pieceCount <= 10
          ? 75
          : input.pieceCount <= 15
            ? 100
            : 150;
    addonsTotal += charge;
    breakdown.push({
      label: `Insurance (up to $${a.insuranceDeclaredValue.toLocaleString()})`,
      amount: charge,
    });
  }

  return {
    baseRate,
    addonsTotal,
    total: baseRate + addonsTotal,
    breakdown,
    requiresCustomQuote: false,
  };
}

/** Appliance delivery uses same band structure as cabinets but different table (max 20 pieces). */
export function calcAppliancePrice(
  input: CabinetPricingInput,
  rateCard: B2BRateCard,
): CabinetPriceResult {
  const fail = (msg: string): CabinetPriceResult => ({
    baseRate: 0,
    addonsTotal: 0,
    total: 0,
    breakdown: [{ label: msg, amount: 0 }],
    requiresCustomQuote: true,
  });

  if (input.zone === "custom") {
    return fail("Zone beyond 160 km — custom quote required");
  }

  const band = getApplianceBand(input.pieceCount);
  if (band === "custom") {
    return fail("Over 20 appliances — custom quote required");
  }

  const rateType = input.isPartner ? "partner" : "standard";
  const zoneRates = rateCard.appliances?.[rateType]?.[input.zone] as
    | ApplianceZoneRates
    | undefined;
  const baseRate = zoneRates?.[band];

  if (!baseRate) {
    return fail("Rate lookup failed — check rate card configuration");
  }

  const breakdown: { label: string; amount: number }[] = [
    {
      label: `${input.pieceCount} appliance${input.pieceCount !== 1 ? "s" : ""} (${band} band) · ${input.zone.replace(/_/g, " ")} · ${rateType}`,
      amount: baseRate,
    },
  ];

  let addonsTotal = 0;
  const a = input.addons;

  if (a.longCarry) {
    const charge = Math.ceil(input.pieceCount / 2) * 35;
    addonsTotal += charge;
    breakdown.push({ label: "Long carry (>50 m)", amount: charge });
  }

  if (a.stairsFlights && a.stairsFlights > 0) {
    const setsOf5 = Math.ceil(input.pieceCount / 5);
    const charge = a.stairsFlights * 35 * setsOf5;
    addonsTotal += charge;
    breakdown.push({
      label: `Stairs: ${a.stairsFlights} flight${a.stairsFlights !== 1 ? "s" : ""} × ${setsOf5} set${setsOf5 !== 1 ? "s" : ""} of 5`,
      amount: charge,
    });
  }

  if (a.weekend) {
    const charge = Math.round(baseRate * 0.1);
    addonsTotal += charge;
    breakdown.push({ label: "Weekend / evening (+10%)", amount: charge });
  }

  if (a.heavyItemCount && a.heavyItemCount > 0) {
    const charge = a.heavyItemCount * 85;
    addonsTotal += charge;
    breakdown.push({
      label: `Heavy items (${a.heavyItemCount} × $85)`,
      amount: charge,
    });
  }

  return {
    baseRate,
    addonsTotal,
    total: baseRate + addonsTotal,
    breakdown,
    requiresCustomQuote: false,
  };
}
