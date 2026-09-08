/**
 * Shared flat-band pricing for the rate-card verticals (flooring, appliance).
 *
 * Single source of truth so the admin pricing-preview (which drives a created
 * delivery's price) and /api/quotes/generate (which drives a sent quote) price
 * these verticals identically. Cabinetry has its own shared primitive
 * (priceCabinetryFlatBand); this covers the other two rate-card verticals so a
 * sent flooring/appliance quote can no longer diverge from what was previewed.
 *
 * Mirrors the logic that previously lived only inside the pricing-preview route.
 * Callers pass the pre-resolved delivery distance from the GTA core (the two
 * routes obtain it differently — one geocodes inline, the other via
 * loadB2bPricingExtras — so distance stays the caller's job).
 */
import { getZoneFromDistance } from "@/lib/b2b/zone-detector";
import { parseRateCard } from "@/lib/b2b/rate-card-types";
import { calcAppliancePrice, calcCabinetPrice } from "@/lib/b2b/cabinet-pricing";
import {
  calcFlooringPrice,
  type FlooringMaterial,
  type FlooringHandling,
} from "@/lib/b2b/flooring-pricing";
import { applyProcessingRecoveryAndRound } from "@/lib/pricing/processing-recovery";
import { recommendTruckForB2B } from "@/lib/pricing/b2b-dimensional";
import { recommendCrewFromWeightItems } from "@/lib/pricing/weight-tiers";

export const B2B_RATE_CARD_VERTICALS = new Set(["flooring", "appliance"]);

export type B2bFlatBandLine = { quantity: number; weight_category?: string };

export type B2bFlatBandInput = {
  /** "flooring" | "appliance". */
  verticalCode: string;
  /** Straight-line km from the GTA core to the delivery, for zone detection. */
  deliveryKmFromGta: number;
  lines: B2bFlatBandLine[];
  isPartner: boolean;
  weekend: boolean;
  longCarry: boolean;
  stairsFlights: number;
  /** Raw handling type (mapped to inside/curbside for flooring). */
  handlingType: string;
  /** Flooring only. */
  flooringMaterial?: string;
  /** Flooring only — overrides the summed unit count when provided. */
  boxCount?: number;
  /** Operator overrides from the builder's "Override recommendation" panel. */
  truckOverride?: string;
  crewOverride?: number;
};

export type B2bFlatBandResult = {
  ok: boolean;
  error?: string;
  subtotalPreRound: number;
  roundedPreTax: number;
  breakdown: { label: string; amount: number }[];
  includes: string[];
  truck: string;
  crew: number;
  estimatedHours: number;
  requiresCustomQuote: boolean;
  totalUnits: number;
  zone: string;
};

/** Flat-band handling → inside (carried in) vs curbside (dock/entrance drop). */
function flatBandHandlingIsInside(handlingType: string): boolean {
  const h = (handlingType || "").toLowerCase();
  return (
    h === "inside" ||
    h === "room_placement" ||
    h === "room_of_choice" ||
    h === "white_glove" ||
    h === "carry_in" ||
    h === "carry_in_per_box" ||
    h === "hand_bomb"
  );
}

/**
 * Estimated on-site hours for a flat-band job. Carry work is per unit, per
 * person, so more crew finishes proportionally faster; the fixed on-site base
 * (park, prep, sign-off, wrap) is not split. Per-unit minutes from flooring-
 * delivery norms: inside carry ~2 min/box, curbside/dock drop ~0.75 min/box;
 * appliance pieces are large single-carries at ~12 min/piece.
 */
function estimateFlatBandHours(args: {
  vertical: string;
  units: number;
  inside: boolean;
  crew: number;
}): number {
  const crew = Math.max(1, args.crew);
  const BASE_MIN = 25;
  const perUnitMin =
    args.vertical === "flooring" ? (args.inside ? 2.0 : 0.75) : 12;
  const totalMin = BASE_MIN + (args.units * perUnitMin) / crew;
  // Round to the nearest quarter hour, floor of 0.5h.
  return Math.max(0.5, Math.round((totalMin / 60) * 4) / 4);
}

/**
 * Price a flooring/appliance job off the rate card. Returns ok:false with an
 * error when the rate card is missing (the caller decides how to surface it).
 */
export function computeB2bFlatBandPrice(
  input: B2bFlatBandInput,
  config: Map<string, string>,
): B2bFlatBandResult {
  const rcRaw = config.get("b2b_rate_card");
  const rateCard = rcRaw ? parseRateCard(rcRaw) : null;

  const totalUnits = input.lines.reduce((s, l) => s + Math.max(1, l.quantity), 0);
  const zone = getZoneFromDistance(input.deliveryKmFromGta ?? 0);

  // Truck + crew sized from the real load, not hardcoded. Flooring sizes off the
  // box count; appliance off the piece count. Operator overrides always win.
  // Uses the same recommenders the dimensional engine + estimate use, so the
  // exact price agrees with the estimate on which truck/crew to send.
  const truckLoad =
    input.verticalCode === "flooring" &&
    typeof input.boxCount === "number" &&
    input.boxCount > 0
      ? Math.round(input.boxCount)
      : totalUnits;
  // Flooring boxes stack compactly, so an extended sprinter covers up to ~89
  // boxes before a larger truck is needed. Appliances keep the default sizing.
  const recommendedTruck = recommendTruckForB2B(
    [],
    truckLoad,
    input.verticalCode === "flooring" ? { sprinter_max_units: 89 } : {},
  );
  const recommendedCrew = recommendCrewFromWeightItems(
    input.lines.map((l) => ({
      weight_category: l.weight_category ?? null,
      quantity: l.quantity,
    })),
    2,
  );
  const truck = input.truckOverride?.trim() ? input.truckOverride.trim() : recommendedTruck;
  const crew =
    typeof input.crewOverride === "number" && input.crewOverride > 0
      ? input.crewOverride
      : recommendedCrew;

  const empty: B2bFlatBandResult = {
    ok: false,
    subtotalPreRound: 0,
    roundedPreTax: 0,
    breakdown: [],
    includes: [],
    truck,
    crew,
    estimatedHours: 0,
    requiresCustomQuote: false,
    totalUnits,
    zone,
  };

  if (!rateCard) {
    return { ...empty, error: "Rate card not configured, run the b2b_rate_card SQL migration" };
  }

  const stairFlights =
    input.stairsFlights > 0 ? Math.floor(input.stairsFlights) : 0;
  const heavyItemCount = input.lines.reduce((s, l) => {
    const wc = (l.weight_category ?? "").toLowerCase();
    return s + (wc === "heavy" || wc === "very_heavy" ? l.quantity : 0);
  }, 0);
  const overweightItemCount = input.lines.reduce((s, l) => {
    const wc = (l.weight_category ?? "").toLowerCase();
    return s + (wc === "super_heavy" ? l.quantity : 0);
  }, 0);

  let result: ReturnType<typeof calcCabinetPrice>;

  if (input.verticalCode === "flooring") {
    const rawMat = (input.flooringMaterial ?? "vinyl").toLowerCase();
    const material: FlooringMaterial =
      rawMat === "hardwood" || rawMat === "tile" ? rawMat : "vinyl";
    // Flooring rate card has two labor tiers: curbside (dropped at the
    // dock/entrance) and inside (carried into the space). Any handling that
    // means "carry each unit in" is inside.
    const handling: FlooringHandling = flatBandHandlingIsInside(input.handlingType)
      ? "inside"
      : "curbside";
    const boxCount =
      typeof input.boxCount === "number" && input.boxCount > 0
        ? Math.round(input.boxCount)
        : totalUnits;

    result = calcFlooringPrice(
      {
        boxCount,
        material,
        handling,
        zone,
        isPartner: input.isPartner,
        addons: {
          stairsFlights: stairFlights,
          longCarry: input.longCarry,
          weekend: input.weekend,
        },
      },
      rateCard,
    );
  } else {
    // appliance
    result = calcAppliancePrice(
      {
        pieceCount: totalUnits,
        zone,
        isPartner: input.isPartner,
        addons: {
          longCarry: input.longCarry,
          stairsFlights: stairFlights,
          weekend: input.weekend,
          heavyItemCount,
        },
      },
      rateCard,
    );
  }

  void overweightItemCount; // appliance/flooring rate cards don't use it today

  const preRoundSubtotal = result.total;
  // Bake CC processing recovery + round at $50, identical to every other
  // non-residential quote path.
  const roundedPreTax = applyProcessingRecoveryAndRound(preRoundSubtotal, config, 50);

  const unitsForHours =
    input.verticalCode === "flooring" &&
    typeof input.boxCount === "number" &&
    input.boxCount > 0
      ? Math.round(input.boxCount)
      : totalUnits;
  const estimatedHours = estimateFlatBandHours({
    vertical: input.verticalCode,
    units: unitsForHours,
    inside: flatBandHandlingIsInside(input.handlingType),
    crew,
  });

  return {
    ok: true,
    subtotalPreRound: preRoundSubtotal,
    roundedPreTax,
    breakdown: result.breakdown,
    includes: [
      `${totalUnits} item${totalUnits !== 1 ? "s" : ""}`,
      zone.replace(/_/g, " "),
      input.isPartner ? "partner rate" : "standard rate",
    ],
    truck,
    crew,
    estimatedHours,
    requiresCustomQuote: result.requiresCustomQuote,
    totalUnits,
    zone,
  };
}
