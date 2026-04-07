import type { createAdminClient } from "@/lib/supabase/admin";
import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";
import { computeB2BDimensionalForOrg } from "@/lib/pricing/b2b-partner-preview";
import { PRICING_ZONES } from "@/lib/maps/pricing-zones";

type Admin = ReturnType<typeof createAdminClient>;

/** Typical GTA pickup for zone estimates (dimensional distance from platform config). */
export const COVERAGE_MAP_PICKUP_ADDRESS =
  "2680 Matheson Blvd E, Mississauga, ON L4W 5M9, Canada";

/**
 * Map UI handling choice to keys the dimensional engine expects per vertical
 * (matches `handling_rates` in `delivery_verticals.default_config`).
 */
export function resolveCoverageHandlingType(
  verticalCode: string,
  uiHandling: string,
): string {
  const ui = (uiHandling || "threshold").toLowerCase();
  if (ui !== "install") return ui;
  switch (verticalCode) {
    case "appliance":
      return "hookup";
    case "office_furniture":
    case "cabinetry":
      return "assembly";
    case "flooring":
      return "room_placement";
    case "ecommerce_bulk":
      return "threshold";
    default:
      return "white_glove";
  }
}

export type CoverageEstimateResult = {
  subtotal: number;
  dist_km: number;
  drive_time_min: number | null;
  vertical_name: string;
  vertical_code: string;
  engine_handling: string;
  sample_address: string;
  breakdown: { label: string; amount: number }[];
};

export async function runCoverageDimensionalEstimate(
  admin: Admin,
  input: {
    partnerOrganizationId: string | null;
    verticalCode: string;
    zoneId: string;
    items: B2BQuoteLineItem[];
    uiHandlingType: string;
  },
): Promise<CoverageEstimateResult | null> {
  const zone = PRICING_ZONES.find((z) => z.id === input.zoneId);
  if (!zone?.sampleDeliveryAddress?.trim()) return null;

  const handling = resolveCoverageHandlingType(
    input.verticalCode,
    input.uiHandlingType,
  );

  const raw = input.items.filter((i) => i.quantity > 0 && i.description.trim());
  if (raw.length === 0) return null;

  const computed = await computeB2BDimensionalForOrg(admin, {
    verticalCode: input.verticalCode,
    partnerOrganizationId: input.partnerOrganizationId,
    items: raw,
    handlingType: handling,
    pickupAddress: COVERAGE_MAP_PICKUP_ADDRESS,
    deliveryAddress: zone.sampleDeliveryAddress,
    roundingNearest: 25,
  });

  if (!computed) return null;

  return {
    subtotal: computed.dim.subtotal,
    dist_km: Math.round(computed.distKm * 10) / 10,
    drive_time_min: computed.driveTimeMin,
    vertical_name: computed.vertical.name,
    vertical_code: computed.vertical.code,
    engine_handling: handling,
    sample_address: zone.sampleDeliveryAddress,
    breakdown: computed.dim.breakdown.map((l) => ({
      label: l.label,
      amount: l.amount,
    })),
  };
}
