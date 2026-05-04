import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { getActiveRateCardLookup } from "@/lib/partners/calculateDeliveryPrice";
import { generateDeliveryNumber } from "@/lib/delivery-number";
import { logActivity } from "@/lib/activity";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";
import { notifyPartnerDeliveryBooked } from "@/lib/partner-job-comms";
import { ensureB2bDeliverySchedule, isDeliveryB2bCategory } from "@/lib/calendar/ensure-b2b-delivery-schedule";
import { normalizeDeliveryCategory } from "@/lib/partners/delivery-category";
import { autoCreateHubSpotDealForNewDelivery } from "@/lib/hubspot/auto-create-deal-for-delivery";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getDeliveryDetailPath } from "@/lib/move-code";
import {
  syncDealStage,
  deliveryStatusToHubspotTrigger,
} from "@/lib/hubspot/sync-deal-stage";

/** POST /api/admin/deliveries/create — Create delivery as admin (e.g. day rate with skip-approval). */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const isB2BOneOff = body.booking_type === "one_off";
    const organizationId = isB2BOneOff ? null : ((body.organization_id || "").trim() || null);
    const explicitOverride = body.override_price;
    const overrideReasonRaw = typeof body.override_reason === "string" ? body.override_reason.trim() : "";
    if (explicitOverride != null && explicitOverride !== "" && Number(explicitOverride) !== 0 && !overrideReasonRaw) {
      return NextResponse.json(
        { error: "override_reason is required when override_price is set" },
        { status: 400 },
      );
    }

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

    const deliveryNumber = await generateDeliveryNumber(admin);
    const trackingCode = `${(org?.name || "YG").replace(/[^A-Z]/gi, "").slice(0, 2).toUpperCase()}-${deliveryNumber.split("-")[1]}`;
    const items = Array.isArray(body.items)
      ? body.items.filter((i: unknown) => typeof i === "string" && i.trim())
      : typeof body.items === "string"
        ? body.items.split("\n").map((i: string) => i.trim()).filter(Boolean)
        : [];

    const rateLookup = await getActiveRateCardLookup(organizationId || "");

    const quotedNum =
      typeof body.quoted_price === "number"
        ? body.quoted_price
        : typeof body.quoted_price === "string"
          ? parseFloat(body.quoted_price.replace(/[^0-9.-]/g, "")) || 0
          : 0;
    const totalFromBody =
      body.total_price != null && body.total_price !== ""
        ? Number(body.total_price)
        : null;
    const calculatedFromBody =
      body.calculated_price != null && body.calculated_price !== ""
        ? Number(body.calculated_price)
        : null;
    const legacyTotal =
      totalFromBody != null && Number.isFinite(totalFromBody) && totalFromBody > 0 ? totalFromBody : null;
    const totalPriceVal =
      legacyTotal != null
        ? legacyTotal
        : isB2BOneOff && quotedNum > 0
          ? Math.round(quotedNum * 1.13 * 100) / 100
          : Number(body.total_price ?? body.quoted_price ?? 0) || 0;

    const calculatedPrice =
      calculatedFromBody != null && Number.isFinite(calculatedFromBody)
        ? calculatedFromBody
        : isB2BOneOff && quotedNum > 0
          ? quotedNum
          : legacyTotal != null
            ? legacyTotal
            : quotedNum > 0
              ? quotedNum
              : 0;

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
      status:
        body.status === "draft"
          ? "draft"
          : String(body.status || "").toLowerCase() === "confirmed"
            ? "confirmed"
            : "scheduled",
      category: organizationId
        ? normalizeDeliveryCategory(org?.type)
        : normalizeDeliveryCategory(
            typeof body.category === "string" ? body.category : "retail",
          ),
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
      total_price: totalPriceVal,
      quoted_price: body.quoted_price ?? body.total_price ?? null,
      calculated_price: calculatedPrice,
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
      vertical_code: (body.vertical_code || "").trim() || null,
      b2b_line_items: body.b2b_line_items != null ? body.b2b_line_items : null,
      b2b_assembly_required: !!body.b2b_assembly_required,
      b2b_debris_removal: !!body.b2b_debris_removal,
      estimated_duration_hours:
        body.estimated_duration_hours != null && body.estimated_duration_hours !== ""
          ? Number(body.estimated_duration_hours)
          : null,
    };

    const isMultiStopB2b = !!body.is_multi_stop;
    const multiRouteStops = Array.isArray(body.multi_route_stops)
      ? (body.multi_route_stops as Record<string, unknown>[])
      : [];

    if (isMultiStopB2b && multiRouteStops.length > 0) {
      insertPayload.is_multi_stop = true;
      insertPayload.total_stops = multiRouteStops.length;
      insertPayload.num_stops = multiRouteStops.length;
      insertPayload.staged_delivery = !!body.staged_delivery;
      insertPayload.phase_count =
        typeof body.phase_count === "number" && body.phase_count >= 1
          ? Math.floor(body.phase_count)
          : 1;
      insertPayload.project_name =
        typeof body.project_name === "string" && body.project_name.trim()
          ? body.project_name.trim()
          : null;
      insertPayload.end_client_name =
        typeof body.end_client_name === "string" && body.end_client_name.trim()
          ? body.end_client_name.trim()
          : null;
      insertPayload.end_client_phone =
        typeof body.end_client_phone === "string" && body.end_client_phone.trim()
          ? body.end_client_phone.trim()
          : null;
      const firstPickup = multiRouteStops.find(
        (s) => String(s.stop_type || "pickup").toLowerCase() !== "delivery",
      );
      const lastDelivery = [...multiRouteStops]
        .reverse()
        .find((s) => String(s.stop_type || "").toLowerCase() === "delivery");
      if (firstPickup && String(firstPickup.address || "").trim()) {
        insertPayload.pickup_address = String(firstPickup.address || "").trim();
      }
      if (lastDelivery && String(lastDelivery.address || "").trim()) {
        insertPayload.delivery_address = String(lastDelivery.address || "").trim();
      }
      if (typeof firstPickup?.access_type === "string" && firstPickup.access_type.trim()) {
        insertPayload.pickup_access = firstPickup.access_type.trim();
      }
      if (typeof lastDelivery?.access_type === "string" && lastDelivery.access_type.trim()) {
        insertPayload.delivery_access = lastDelivery.access_type.trim();
      }
    }

    if (
      explicitOverride != null &&
      explicitOverride !== "" &&
      Number.isFinite(Number(explicitOverride)) &&
      Number(explicitOverride) !== 0 &&
      overrideReasonRaw
    ) {
      insertPayload.override_price = Number(explicitOverride);
      insertPayload.override_reason = overrideReasonRaw;
    }

    const crewIdForSnap = insertPayload.crew_id as string | null;
    if (crewIdForSnap) {
      const snap = await fetchCrewAssignmentSnapshot(admin, crewIdForSnap);
      insertPayload.assigned_members = snap.assigned_members;
      insertPayload.assigned_crew_name = snap.assigned_crew_name;
    }

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
    if (
      created &&
      isMultiStopB2b &&
      multiRouteStops.length > 0
    ) {
      for (let i = 0; i < multiRouteStops.length; i++) {
        const s = multiRouteStops[i];
        const addr = String(s.address || "").trim();
        if (!addr) continue;
        const stRaw = String(s.stop_type || "pickup").toLowerCase();
        const stype = stRaw === "delivery" ? "delivery" : "pickup";
        const itemArr = Array.isArray(s.items) ? (s.items as Record<string, unknown>[]) : [];
        const linesSummary = itemArr
          .map((it) => {
            const q = Math.max(1, Number(it.quantity) || 1);
            const d = String(it.description || "").trim();
            if (!d) return null;
            return q > 1 ? `${q}× ${d}` : d;
          })
          .filter(Boolean)
          .join("; ");
        const contactName =
          typeof s.contact_name === "string" && s.contact_name.trim()
            ? s.contact_name.trim()
            : null;
        const contactPhone =
          typeof s.contact_phone === "string" && s.contact_phone.trim()
            ? s.contact_phone.trim()
            : null;
        const contactEmail =
          typeof s.contact_email === "string" && s.contact_email.trim()
            ? s.contact_email.trim()
            : null;
        const vendorName =
          typeof s.vendor_name === "string" && s.vendor_name.trim()
            ? s.vendor_name.trim()
            : null;
        const accessType =
          typeof s.access_type === "string" && s.access_type.trim()
            ? s.access_type.trim()
            : "ground_floor";
        const accessNotes =
          typeof s.access_notes === "string" && s.access_notes.trim()
            ? s.access_notes.trim()
            : null;
        const readiness =
          typeof s.readiness === "string" && s.readiness.trim()
            ? s.readiness.trim()
            : "confirmed";
        const readinessNotes =
          typeof s.readiness_notes === "string" && s.readiness_notes.trim()
            ? s.readiness_notes.trim()
            : null;
        const notes =
          typeof s.notes === "string" && s.notes.trim() ? s.notes.trim() : null;
        const specialInstructions =
          typeof s.special_instructions === "string" && s.special_instructions.trim()
            ? s.special_instructions.trim()
            : null;
        const isFinal = !!s.is_final_destination;
        const phase =
          typeof s.delivery_phase === "number" && Number.isFinite(s.delivery_phase)
            ? Math.max(1, Math.floor(s.delivery_phase))
            : 1;
        const estMin =
          typeof s.estimated_duration_minutes === "number" &&
          Number.isFinite(s.estimated_duration_minutes)
            ? Math.max(5, Math.floor(s.estimated_duration_minutes))
            : 30;
        const lat =
          s.lat != null && Number.isFinite(Number(s.lat)) ? Number(s.lat) : null;
        const lng =
          s.lng != null && Number.isFinite(Number(s.lng)) ? Number(s.lng) : null;

        const { data: insertedStop, error: stopErr } = await admin
          .from("delivery_stops")
          .insert({
            delivery_id: created.id,
            stop_number: i + 1,
            address: addr,
            lat,
            lng,
            vendor_name: vendorName,
            contact_name: contactName,
            contact_phone: contactPhone,
            contact_email: contactEmail,
            customer_name: contactName ?? vendorName,
            customer_phone: contactPhone,
            access_type: accessType,
            access_notes: accessNotes,
            readiness,
            readiness_notes: readinessNotes,
            estimated_duration_minutes: estMin,
            is_final_destination: isFinal,
            delivery_phase: phase,
            stop_type: stype,
            items_description: linesSummary || null,
            special_instructions: specialInstructions,
            notes,
            stop_status: i === 0 ? "current" : "pending",
            status: i === 0 ? "current" : "pending",
            services_selected: [],
          })
          .select("id")
          .single();

        if (stopErr || !insertedStop?.id) {
          console.error("[admin-delivery-create] delivery_stops insert:", stopErr?.message);
          continue;
        }

        for (const it of itemArr) {
          const desc = String(it.description || "").trim();
          if (!desc) continue;
          const qty = Math.max(1, Number(it.quantity) || 1);
          const wrRaw = String(it.weight_range || it.weight_category || "standard").toLowerCase();
          const { error: itemErr } = await admin.from("delivery_stop_items").insert({
            stop_id: insertedStop.id,
            description: desc,
            quantity: qty,
            weight_range: wrRaw,
            is_fragile: !!it.is_fragile,
            is_high_value: !!it.is_high_value,
            requires_assembly: !!it.requires_assembly,
            status: "pending",
          });
          if (itemErr) {
            console.error("[admin-delivery-create] delivery_stop_items:", itemErr.message);
          }
        }
      }
    } else if (body.booking_type === "day_rate" && stopsRaw.length > 0 && created) {
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
      if (isDeliveryB2bCategory(insertPayload.category as string)) {
        await ensureB2bDeliverySchedule(admin, created.id).catch((e) =>
          console.error("[admin-delivery-create] ensureB2bDeliverySchedule:", e),
        );
      }
      await logActivity({
        entity_type: "delivery",
        entity_id: created.id,
        event_type: "created",
        description: `Delivery created: ${customerName}${scheduledDate ? `, ${scheduledDate}` : ""} (${created.delivery_number})`,
        icon: "delivery",
      });
    }

    const createdStatus = String(insertPayload.status || "").toLowerCase();
    if (
      created &&
      createdStatus !== "draft" &&
      createdStatus !== "pending_approval" &&
      createdStatus !== "pending"
    ) {
      notifyPartnerDeliveryBooked(created.id).catch(() => {});
    }

    let hubspotDuplicate:
      | { dealId: string; dealName: string; dealStageId: string }
      | undefined;
    let hubspotAutoCreateFailed = false;

    const hubSpotToken = process.env.HUBSPOT_ACCESS_TOKEN;
    const emailForHs = (
      (insertPayload.contact_email as string)?.trim() ||
      (insertPayload.customer_email as string)?.trim() ||
      (insertPayload.end_customer_email as string)?.trim() ||
      ""
    ).toLowerCase();

    if (
      emailForHs &&
      hubSpotToken &&
      created &&
      createdStatus !== "draft"
    ) {
      const bookingType = String(insertPayload.booking_type || "").toLowerCase();
      const primaryContactLabel =
        bookingType === "one_off"
          ? String(insertPayload.contact_name || insertPayload.customer_name || customerName || "")
              .trim() || customerName
          : String(insertPayload.customer_name || insertPayload.contact_name || customerName || "")
              .trim() || customerName;
      const nameParts = primaryContactLabel.split(/\s+/);
      const fName = nameParts[0]?.trim() || "Contact";
      const lName = nameParts.slice(1).join(" ").trim();
      const base = getEmailBaseUrl();
      const path = getDeliveryDetailPath({
        delivery_number: created.delivery_number as string | undefined,
        id: created.id as string,
      });
      const deliveryAdminUrl = `${base}${path}`;

      const createdHs = await autoCreateHubSpotDealForNewDelivery({
        sb: admin,
        delivery: {
          id: created.id as string,
          scheduled_date: insertPayload.scheduled_date as string | null,
          pickup_address: insertPayload.pickup_address as string | null,
          delivery_address: insertPayload.delivery_address as string | null,
          pickup_access: insertPayload.pickup_access as string | null,
          delivery_access: insertPayload.delivery_access as string | null,
          calculated_price:
            insertPayload.calculated_price != null
              ? Number(insertPayload.calculated_price)
              : null,
          quoted_price:
            insertPayload.quoted_price != null ? Number(insertPayload.quoted_price) : null,
          total_price:
            insertPayload.total_price != null ? Number(insertPayload.total_price) : null,
          booking_type: insertPayload.booking_type as string | null,
          vertical_code: insertPayload.vertical_code as string | null,
          business_name: insertPayload.business_name as string | null,
          client_name: insertPayload.client_name as string | null,
          contact_name: insertPayload.contact_name as string | null,
        },
        deliveryNumber: String(created.delivery_number || ""),
        clientEmail: emailForHs,
        firstName: fName,
        lastName: lName,
        clientPhone:
          (insertPayload.contact_phone as string)?.trim() ||
          (insertPayload.customer_phone as string)?.trim() ||
          null,
        deliveryAdminUrl,
      });

      if (createdHs?.status === "created" && createdHs.dealId) {
        await admin
          .from("deliveries")
          .update({ hubspot_deal_id: createdHs.dealId })
          .eq("id", created.id);
        const trig = deliveryStatusToHubspotTrigger(insertPayload.status as string | null);
        if (trig) await syncDealStage(createdHs.dealId, trig).catch(() => {});
      } else if (createdHs?.status === "duplicate") {
        hubspotDuplicate = {
          dealId: createdHs.existingDealId,
          dealName: createdHs.existingDealName,
          dealStageId: createdHs.existingDealStageId,
        };
      } else if (createdHs == null) {
        hubspotAutoCreateFailed = true;
      }
    }

    return NextResponse.json({
      ok: true,
      delivery: created,
      ...(hubspotDuplicate ? { hubspotDuplicate } : {}),
      ...(hubspotAutoCreateFailed ? { hubspotAutoCreateFailed: true } : {}),
    });
  } catch (err: unknown) {
    console.error("[admin-delivery-create] EXCEPTION:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create delivery" },
      { status: 500 },
    );
  }
}
