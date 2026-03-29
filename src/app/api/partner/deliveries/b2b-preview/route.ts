import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { computeB2BDimensionalForOrg } from "@/lib/pricing/b2b-partner-preview";
import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) {
    return NextResponse.json({ error: "No organization linked" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const verticalCode = String(body.vertical_code || "").trim();
  const pickupAddress = String(body.pickup_address || "").trim();
  const deliveryAddress = String(body.delivery_address || "").trim();
  const handlingType = String(body.handling_type || "threshold").trim();

  if (!verticalCode || !deliveryAddress) {
    return NextResponse.json({ error: "vertical_code and delivery_address are required" }, { status: 400 });
  }

  const rawItems = body.items;
  const items: B2BQuoteLineItem[] = Array.isArray(rawItems)
    ? rawItems
        .filter((x): x is Record<string, unknown> => x && typeof x === "object")
        .map((x) => ({
          description: String(x.description || "").trim() || "Item",
          quantity: Math.max(1, Number(x.quantity) || 1),
        }))
    : [{ description: "Delivery", quantity: 1 }];

  const admin = createAdminClient();
  const rounding = 25;

  const [standardP, partnerP] = await Promise.all([
    computeB2BDimensionalForOrg(admin, {
      verticalCode,
      partnerOrganizationId: null,
      items,
      handlingType,
      pickupAddress: pickupAddress || deliveryAddress,
      deliveryAddress,
      deliveryAccess: String(body.delivery_access || "").trim() || undefined,
      assemblyRequired: !!body.assembly_required,
      debrisRemoval: !!body.debris_removal,
      stairsFlights: typeof body.stairs_flights === "number" ? body.stairs_flights : undefined,
      roundingNearest: rounding,
    }),
    computeB2BDimensionalForOrg(admin, {
      verticalCode,
      partnerOrganizationId: primaryOrgId,
      items,
      handlingType,
      pickupAddress: pickupAddress || deliveryAddress,
      deliveryAddress,
      deliveryAccess: String(body.delivery_access || "").trim() || undefined,
      assemblyRequired: !!body.assembly_required,
      debrisRemoval: !!body.debris_removal,
      stairsFlights: typeof body.stairs_flights === "number" ? body.stairs_flights : undefined,
      roundingNearest: rounding,
    }),
  ]);

  if (!partnerP) {
    return NextResponse.json({ error: "Pricing unavailable for this vertical" }, { status: 400 });
  }

  const standardSubtotal = standardP?.dim.subtotal ?? partnerP.dim.subtotal;

  return NextResponse.json({
    vertical_code: partnerP.vertical.code,
    vertical_name: partnerP.vertical.name,
    dist_km: partnerP.distKm,
    partner_subtotal: partnerP.dim.subtotal,
    standard_subtotal: standardSubtotal,
    breakdown: partnerP.dim.breakdown,
    standard_breakdown: standardP?.dim.breakdown ?? null,
    discount_percent:
      standardSubtotal > 0
        ? Math.round((1 - partnerP.dim.subtotal / standardSubtotal) * 1000) / 10
        : 0,
  });
}
