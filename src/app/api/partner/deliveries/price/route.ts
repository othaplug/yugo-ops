import { NextRequest, NextResponse } from "next/server";
import { requirePartner } from "@/lib/partner-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateDayRate, calculatePerDelivery, detectZone, getVolumeDiscount, getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";

export async function POST(req: NextRequest) {
  const { primaryOrgId, orgIds, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No organization linked" }, { status: 403 });

  try {
    const body = await req.json();
    const { booking_type, vehicle_type, day_type, num_stops, delivery_type, distance_km, services, is_after_hours, is_weekend, oversized_count, delivery_access, item_weight_category } = body;

    const db = createAdminClient();

    const { data: org } = await db
      .from("organizations")
      .select("pricing_tier")
      .eq("id", primaryOrgId)
      .single();

    const pricingTier = (org?.pricing_tier === "partner" ? "partner" : "standard") as "standard" | "partner";

    const lookup = await getActiveRateCardLookup(primaryOrgId);
    if (!lookup.rateCardId && !lookup.templateId) {
      return NextResponse.json({ error: "No rate card configured" }, { status: 404 });
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

      if (Array.isArray(body.stops_zones)) {
        for (const sz of body.stops_zones) {
          if (sz.zone && sz.zone >= 2) {
            const zoneResult = await detectZone(rateCardId, sz.zone === 2 ? 50 : sz.zone === 3 ? 85 : 110, pricingTier, lookup);
            if (zoneResult.surcharge > 0) {
              result.zoneSurcharge += zoneResult.surcharge;
              result.totalPrice += zoneResult.surcharge;
              result.breakdown.push({
                label: `Zone ${zoneResult.zone} surcharge (stop ${sz.stop_number})`,
                amount: zoneResult.surcharge,
              });
            }
          }
        }
        if (num_stops > 0) {
          result.effectivePerStop = Math.round(result.totalPrice / num_stops);
        }
      }

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
        deliveryAccess: delivery_access || null,
        itemWeightCategory: item_weight_category || null,
      });

      const thisMonth = new Date().toISOString().slice(0, 7);
      const { count } = await db
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .in("organization_id", orgIds)
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
      { error: err instanceof Error ? err.message : "Pricing failed" },
      { status: 500 },
    );
  }
}
