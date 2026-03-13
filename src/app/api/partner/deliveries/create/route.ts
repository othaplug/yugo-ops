import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";
import { generateDeliveryNumber } from "@/lib/delivery-number";

export async function POST(req: NextRequest) {
  const { primaryOrgId, userId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No organization linked" }, { status: 403 });

  try {
    const body = await req.json();
    const admin = createAdminClient();

    const { data: org } = await admin
      .from("organizations")
      .select("name, type, pricing_tier")
      .eq("id", primaryOrgId)
      .single();

    const customerName = (body.customer_name || "").trim();
    const deliveryAddress = (body.delivery_address || "").trim();
    const scheduledDate = (body.scheduled_date || "").trim();

    if (!customerName) return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!deliveryAddress) return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
    if (!scheduledDate) return NextResponse.json({ error: "Date is required" }, { status: 400 });

    const deliveryNumber = generateDeliveryNumber();
    const trackingCode = `${(org?.name || "YG").replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase()}-${deliveryNumber.split("-")[1]}`;
    const items = Array.isArray(body.items)
      ? body.items.filter((i: unknown) => typeof i === "string" && i.trim())
      : typeof body.items === "string"
        ? body.items.split("\n").map((i: string) => i.trim()).filter(Boolean)
        : [];

    const rateLookup = await getActiveRateCardLookup(primaryOrgId);

    const insertPayload: Record<string, unknown> = {
      delivery_number: deliveryNumber,
      organization_id: primaryOrgId,
      client_name: org?.name || "",
      customer_name: customerName,
      customer_email: (body.customer_email || "").trim() || null,
      customer_phone: (body.customer_phone || "").trim() || null,
      pickup_address: (body.pickup_address || "").trim() || null,
      delivery_address: deliveryAddress,
      scheduled_date: scheduledDate,
      time_slot: (body.time_slot || "").trim() || null,
      delivery_window: (body.delivery_window || "").trim() || null,
      items,
      instructions: (body.instructions || "").trim() || null,
      special_handling: !!body.special_handling,
      status: "pending_approval",
      category: org?.type || "retail",
      created_by_source: "partner_portal",
      created_by_user: userId || null,
      // Pricing fields
      booking_type: body.booking_type || null,
      rate_card_id: rateLookup.rateCardId || null,
      vehicle_type: body.vehicle_type || null,
      day_type: body.day_type || null,
      num_stops: body.num_stops || null,
      delivery_type: body.delivery_type || null,
      zone: body.zone || null,
      base_price: body.base_price || 0,
      overage_price: body.overage_price || 0,
      services_price: body.services_price || 0,
      zone_surcharge: body.zone_surcharge || 0,
      after_hours_surcharge: body.after_hours_surcharge || 0,
      total_price: body.total_price ?? body.quoted_price ?? 0,
      services_selected: body.services_selected || [],
      end_customer_name: (body.end_customer_name || customerName).trim() || null,
      end_customer_phone: (body.end_customer_phone || body.customer_phone || "").trim() || null,
      end_customer_email: (body.end_customer_email || body.customer_email || "").trim() || null,
      stops_detail: Array.isArray(body.stops_detail) ? body.stops_detail : [],
      recommended_vehicle: body.recommended_vehicle || null,
      recommended_day_type: body.recommended_day_type || null,
      tracking_code: trackingCode,
    };

    console.log("[delivery-create] inserting for org:", primaryOrgId, "status: pending_approval, date:", scheduledDate);

    const { data: created, error: dbError } = await admin
      .from("deliveries")
      .insert(insertPayload as Record<string, never>)
      .select("id, delivery_number")
      .single();

    if (dbError) {
      console.error("[delivery-create] INSERT failed:", dbError.message, dbError.code, dbError.details);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    console.log("[delivery-create] SUCCESS:", created?.id, created?.delivery_number);

    // If day-rate with stops, insert stop details
    if (body.booking_type === "day_rate" && Array.isArray(body.stops) && created) {
      const stopRows = body.stops.map((s: Record<string, unknown>, i: number) => ({
        delivery_id: created.id,
        stop_number: i + 1,
        address: s.address || "",
        customer_name: s.customer_name || null,
        customer_phone: s.customer_phone || null,
        items_description: s.items_description || null,
        services_selected: s.services_selected || [],
        special_instructions: s.special_instructions || null,
        zone: s.zone || null,
      }));
      await admin.from("delivery_stops").insert(stopRows);
    }

    return NextResponse.json({ ok: true, delivery: created });
  } catch (err: unknown) {
    console.error("[delivery-create] EXCEPTION:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create delivery" },
      { status: 500 },
    );
  }
}
