import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";
import { calculateDayRate, calculatePerDelivery, detectZone, getVolumeDiscount, getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { organization_id, booking_type, vehicle_type, day_type, num_stops, delivery_type, distance_km, services, is_after_hours, is_weekend, oversized_count } = body;

    if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 });

    const db = createAdminClient();

    // Get org pricing tier
    const { data: org } = await db
      .from("organizations")
      .select("pricing_tier")
      .eq("id", organization_id)
      .single();

    const pricingTier = (org?.pricing_tier === "partner" ? "partner" : "standard") as "standard" | "partner";

    // Get active rate card / template
    const lookup = await getActiveRateCardLookup(organization_id);
    if (!lookup.rateCardId && !lookup.templateId) {
      return NextResponse.json({ error: "No active rate card for this partner" }, { status: 404 });
    }
    const rateCardId = lookup.rateCardId || lookup.templateId!;

    if (booking_type === "day_rate") {
      const result = await calculateDayRate({
        rateCardId,
        vehicleType: vehicle_type,
        dayType: day_type || "full_day",
        numStops: num_stops || 0,
        services: services || [],
        isAfterHours: !!is_after_hours,
        isWeekend: !!is_weekend,
        pricingTier,
        lookup,
        oversizedCount: oversized_count || 0,
      });
      return NextResponse.json(result);
    }

    if (booking_type === "per_delivery") {
      const zone = distance_km != null
        ? (await detectZone(rateCardId, distance_km, pricingTier, lookup)).zone
        : body.zone || 1;

      const result = await calculatePerDelivery({
        rateCardId,
        deliveryType: delivery_type || "single_item",
        zone,
        services: services || [],
        isAfterHours: !!is_after_hours,
        isWeekend: !!is_weekend,
        pricingTier,
        lookup,
      });

      // Check volume discount
      const thisMonth = new Date().toISOString().slice(0, 7);
      const { count } = await db
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .gte("scheduled_date", `${thisMonth}-01`)
        .in("status", ["completed", "delivered", "in_transit", "scheduled", "confirmed"]);

      const discount = await getVolumeDiscount(rateCardId, (count || 0) + 1, lookup);
      if (discount > 0) {
        const discountAmount = Math.round(result.totalPrice * (discount / 100));
        result.volumeDiscount = discountAmount;
        result.totalPrice -= discountAmount;
        result.breakdown.push({ label: `Volume Discount (${discount}%)`, amount: -discountAmount });
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid booking_type" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pricing calculation failed" },
      { status: 500 },
    );
  }
}
