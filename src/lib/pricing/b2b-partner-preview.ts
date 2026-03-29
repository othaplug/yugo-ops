import { getDrivingDistance } from "@/lib/mapbox/driving-distance";
import {
  calculateB2BDimensionalPrice,
  type B2BDimensionalQuoteInput,
  type B2BQuoteLineItem,
} from "@/lib/pricing/b2b-dimensional";
import { loadB2BVerticalPricing } from "@/lib/pricing/b2b-vertical-load";
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

  const dimInput: B2BDimensionalQuoteInput = {
    vertical_code: loaded.vertical.code,
    items: opts.items.filter((i) => i.quantity > 0 && i.description.trim()),
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
    mergedRates: loaded.mergedRates,
    input: dimInput,
    totalDistanceKm: distKm,
    roundingNearest: opts.roundingNearest,
    parkingLongCarryTotal: 0,
  });

  return {
    vertical: loaded.vertical,
    mergedRates: loaded.mergedRates,
    dim,
    distKm,
    driveTimeMin: dist?.drive_time_min ?? null,
  };
}
