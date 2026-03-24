import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";
import { generateDeliveryNumber } from "@/lib/delivery-number";
import { logActivity } from "@/lib/activity";

const VALID_CATEGORIES = new Set(["retail", "b2b", "b2c", "designer", "hospitality", "realtor", "stager", "other"]);
function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (VALID_CATEGORIES.has(lower)) return lower;
  if (lower.startsWith("b2b")) return "b2b";
  return "retail";
}

/** POST /api/admin/deliveries/create — Create delivery as admin (e.g. day rate with skip-approval). */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const isB2BOneOff = body.booking_type === "one_off";
    const organizationId = isB2BOneOff ? null : ((body.organization_id || "").trim() || null);

    const admin = createAdminClient();

    const { data: org } = organizationId
      ? await admin.from("organizations").select("name, type, pricing_tier").eq("id", organizationId).single()
      : { data: null };

    const customerName = (body.customer_name || body.contact_name || "").trim();
    const deliveryAddress = (body.delivery_address || "").trim();
    const scheduledDate = (body.scheduled_date || "").trim();
    const businessName = (body.business_name || "").trim();

    if (isB2BOneOff) {
      if (!businessName) return NextResponse.json({ error: "Business name is required" }, { status: 400 });
      if (!(body.contact_name || "").trim()) return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
      if (!(body.contact_phone || "").trim()) return NextResponse.json({ error: "Contact phone is required" }, { status: 400 });
    }
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

    const rateLookup = await getActiveRateCardLookup(organizationId || "");

    const insertPayload: Record<string, unknown> = {
      delivery_number: deliveryNumber,
      organization_id: organizationId || null,
      client_name: isB2BOneOff ? businessName : ((body.client_name || org?.name || "").trim() || ""),
      business_name: isB2BOneOff ? businessName : null,
      contact_name: isB2BOneOff ? (body.contact_name || "").trim() || null : null,
      contact_phone: isB2BOneOff ? (body.contact_phone || "").trim() || null : null,
      contact_email: isB2BOneOff ? (body.contact_email || "").trim() || null : null,
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
      status: "scheduled",
      category: normalizeCategory((body.category || org?.type || "retail").trim() || "retail"),
      created_by_source: "admin",
      created_by_user: null,
      booking_type: isB2BOneOff ? "one_off" : (body.booking_type || null),
      rate_card_id: rateLookup.rateCardId || null,
      vehicle_type: body.vehicle_type || null,
      day_type: body.day_type || null,
      num_stops: body.num_stops || null,
      delivery_type: body.delivery_type || null,
      zone: body.zone || null,
      pickup_access: body.pickup_access || null,
      delivery_access: body.delivery_access || null,
      item_weight_category: body.item_weight_category || null,
      pricing_breakdown: Array.isArray(body.pricing_breakdown) ? body.pricing_breakdown : null,
      base_price: body.base_price || 0,
      overage_price: body.overage_price || 0,
      services_price: body.services_price || 0,
      zone_surcharge: body.zone_surcharge || 0,
      after_hours_surcharge: body.after_hours_surcharge || 0,
      total_price: body.total_price ?? body.quoted_price ?? 0,
      quoted_price: body.quoted_price ?? body.total_price ?? null,
      services_selected: body.services_selected || [],
      end_customer_name: (body.end_customer_name || customerName).trim() || null,
      end_customer_phone: (body.end_customer_phone || body.customer_phone || "").trim() || null,
      end_customer_email: (body.end_customer_email || body.customer_email || "").trim() || null,
      stops_detail: Array.isArray(body.stops_detail) ? body.stops_detail : [],
      recommended_vehicle: body.recommended_vehicle || null,
      recommended_day_type: body.recommended_day_type || null,
      tracking_code: trackingCode,
      crew_id: (body.crew_id || "").trim() || null,
      project_id: (body.project_id || "").trim() || null,
      phase_id: (body.phase_id || "").trim() || null,
    };

    const { data: created, error: dbError } = await admin
      .from("deliveries")
      .insert(insertPayload as Record<string, never>)
      .select("id, delivery_number")
      .single();

    if (dbError) {
      console.error("[admin-delivery-create] INSERT failed:", dbError.message);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    const stopsRaw = Array.isArray(body.stops) ? body.stops : (Array.isArray(body.stops_detail) ? body.stops_detail : []);
    if (body.booking_type === "day_rate" && stopsRaw.length > 0 && created) {
      const stopRows = stopsRaw.map((s: Record<string, unknown>, i: number) => ({
        delivery_id: created.id,
        stop_number: i + 1,
        address: s.address || "",
        customer_name: s.customer_name ?? s.customerName ?? null,
        customer_phone: s.customer_phone ?? s.customerPhone ?? null,
        items_description: s.items_description ?? (Array.isArray(s.items) ? JSON.stringify(s.items) : null),
        services_selected: s.services_selected ?? (s.services ? Object.entries(s.services as Record<string, unknown>).filter(([, v]) => (v as { enabled?: boolean })?.enabled).map(([slug]) => ({ slug, quantity: 1 })) : []),
        special_instructions: s.special_instructions ?? s.instructions ?? null,
        zone: s.zone ?? null,
      }));
      await admin.from("delivery_stops").insert(stopRows);
    }

    if (created) {
      await logActivity({
        entity_type: "delivery",
        entity_id: created.id,
        event_type: "created",
        description: `Delivery created: ${customerName}${scheduledDate ? `, ${scheduledDate}` : ""} (${created.delivery_number})`,
        icon: "delivery",
      });
    }

    return NextResponse.json({ ok: true, delivery: created });
  } catch (err: unknown) {
    console.error("[admin-delivery-create] EXCEPTION:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create delivery" },
      { status: 500 },
    );
  }
}
