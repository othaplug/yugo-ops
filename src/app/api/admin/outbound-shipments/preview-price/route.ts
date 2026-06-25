/**
 * POST /api/admin/outbound-shipments/preview-price
 *
 * Pure pricing-preview endpoint for the admin Create form. Doesn't touch
 * the DB — coordinators type inputs, see the breakdown live, then submit.
 *
 * Body: OutboundStagingPricingInputs (see pricing.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { priceOutboundStagingShipment } from "@/lib/outbound-staging/pricing";

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  let body: {
    pickup_distance_km?: number;
    pallet_count?: number;
    declared_value?: number;
    expected_hold_days?: number;
    crating_required?: boolean;
    outside_standard_zone?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = priceOutboundStagingShipment({
    pickupDistanceKm: Number(body.pickup_distance_km ?? 0),
    palletCount: Math.max(1, Number(body.pallet_count ?? 1)),
    declaredValue: Number(body.declared_value ?? 0),
    expectedHoldDays: Number(body.expected_hold_days ?? 0),
    cratingRequired: !!body.crating_required,
    outsideStandardZone: !!body.outside_standard_zone,
  });

  return NextResponse.json(result);
}
