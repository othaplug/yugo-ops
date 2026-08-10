import { getDrivingDistance, straightLineKmFromGtaCore } from "@/lib/mapbox/driving-distance";
import {
  calculateB2BDimensionalPrice,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
} from "@/lib/pricing/b2b-dimensional";
import { priceCabinetryFlatBand } from "@/lib/pricing/b2b-flatband";
import { loadB2BVerticalPricing } from "@/lib/pricing/b2b-vertical-load";
import {
  mergedRatesWithBundleTiers,
  prepareB2bLineItemsForDimensionalEngine,
} from "@/lib/b2b-dimensional-quote-prep";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function computeB2BDimensionalForOrg(
  admin: Admin,
  opts: {
    verticalCode: string;
    partnerOrganizationId: string | null;
    items: B2BQuoteLineItem[];
    handlingType: string;
    pickupAddress: string;
    deliveryAddress: string;
    deliveryAccess?: string;
    assemblyRequired?: boolean;
    debrisRemoval?: boolean;
    stairsFlights?: number;
    roundingNearest: number;
  },
) {
  const from = opts.pickupAddress.trim();
  const to = opts.deliveryAddress.trim();
  const dist = from && to ? await getDrivingDistance(from, to) : null;
  const distKm = dist?.distance_km ?? 0;

  const loaded = await loadB2BVerticalPricing(admin, opts.verticalCode, opts.partnerOrganizationId);
  if (!loaded) return null;

  // Cabinetry: shared cabinet-unit engine (same as the admin preview + generate),
  // so partner self-serve previews never show the old per-piece over-quote.
  if (loaded.vertical.code === "cabinetry") {
    const { data: cabCfgRows } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", [
        "b2b_cabinetry_rate",
        "processing_recovery_rate",
        "processing_recovery_flat",
        "tax_rate",
      ]);
    const cabCfg = new Map<string, string>(
      (cabCfgRows ?? []).map((r) => [r.key, String(r.value ?? "")]),
    );
    const deliveryKmFromOffice = (await straightLineKmFromGtaCore(to)) ?? 0;
    const rawCab = opts.items.filter((i) => i.quantity > 0 && i.description.trim());
    const fb = priceCabinetryFlatBand(
      {
        lines: rawCab.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          weight_category: i.weight_category,
          unit_type: i.unit_type,
          declared_value: i.declared_value,
        })),
        deliveryKmFromOffice,
        extraPickupStops: 0,
        handlingType: (opts.handlingType || "threshold").toLowerCase(),
        isPartner: !!opts.partnerOrganizationId,
        weekend: false,
        longCarry: opts.deliveryAccess === "long_carry",
        stairsFlights: opts.stairsFlights ?? 0,
      },
      cabCfg,
    );
    return {
      vertical: loaded.vertical,
      mergedRates: loaded.mergedRates,
      dim: {
        subtotal: fb.roundedPreTax,
        breakdown: fb.breakdown,
        includes: fb.includes,
        truck: fb.truck,
        crew: fb.crew,
        estimatedHours: 0,
      },
      distKm,
      driveTimeMin: dist?.drive_time_min ?? null,
    };
  }

  const { data: cfgRows } = await admin.from("platform_config").select("key, value").like("key", "truck_fee_%");
  const platformConfig: Record<string, string> = Object.fromEntries(
    (cfgRows ?? []).map((r) => [r.key, String(r.value ?? "")]),
  );

  const raw = opts.items.filter((i) => i.quantity > 0 && i.description.trim());
  const mergedCalc = mergedRatesWithBundleTiers(loaded.mergedRates as Record<string, unknown>);
  const engineItems = prepareB2bLineItemsForDimensionalEngine(
    raw,
    loaded.vertical.code,
    (opts.handlingType || "threshold").toLowerCase(),
    loaded.mergedRates as Record<string, unknown>,
  );

  const dimInput: B2BDimensionalQuoteInput = {
    vertical_code: loaded.vertical.code,
    items: engineItems,
    handling_type: (opts.handlingType || "threshold").toLowerCase(),
    stops: [
      { type: "pickup", address: from },
      { type: "delivery", address: to, access: opts.deliveryAccess },
    ],
    assembly_required: !!opts.assemblyRequired,
    debris_removal: !!opts.debrisRemoval,
    stairs_flights: opts.stairsFlights,
  };

  const dim = calculateB2BDimensionalPrice({
    vertical: loaded.vertical,
    mergedRates: mergedCalc,
    input: dimInput,
    totalDistanceKm: distKm,
    roundingNearest: opts.roundingNearest,
    parkingLongCarryTotal: 0,
    platformConfig,
  });

  return {
    vertical: loaded.vertical,
    mergedRates: loaded.mergedRates,
    dim,
    distKm,
    driveTimeMin: dist?.drive_time_min ?? null,
  };
}
