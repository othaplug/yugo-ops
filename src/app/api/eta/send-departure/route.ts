import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { buildETAMessage } from "@/lib/sms/etaMessages";
import {
  buildPublicDeliveryTrackUrl,
  buildPublicMoveTrackUrl,
} from "@/lib/notifications/public-track-url";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

async function getETAMinutes(
  crewLat: number,
  crewLng: number,
  destLat: number,
  destLng: number
): Promise<number> {
  if (!MAPBOX_TOKEN) return 30;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${crewLng},${crewLat};${destLng},${destLat}?access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.routes?.[0]?.duration) {
    return Math.ceil(data.routes[0].duration / 60);
  }
  return 30;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, jobType } = body;
    if (!jobId || !jobType || !["move", "delivery"].includes(jobType)) {
      return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const cfg = await getFeatureConfig(["sms_eta_enabled"]);
    const smsEnabled = cfg.sms_eta_enabled === "true";

    if (jobType === "move") {
      const { data: move } = await admin
        .from("moves")
        .select(
          "id, move_code, client_name, client_phone, from_address, to_address, to_lat, to_lng, tier_selected, dedicated_coordinator, crew_id"
        )
        .eq("id", jobId)
        .maybeSingle();

      if (!move?.client_phone || !move.crew_id) {
        return NextResponse.json({ ok: false, skipped: "no_phone_or_crew" });
      }

      const { data: crewPos } = await admin
        .from("crew_locations")
        .select("lat, lng")
        .eq("crew_id", move.crew_id)
        .maybeSingle();

      const destLat = move.to_lat ?? 0;
      const destLng = move.to_lng ?? 0;
      const crewLat = crewPos?.lat ? Number(crewPos.lat) : 0;
      const crewLng = crewPos?.lng ? Number(crewPos.lng) : 0;

      let etaMinutes = 30;
      if (destLat && destLng && (crewLat || crewLng)) {
        etaMinutes = await getETAMinutes(crewLat || 0, crewLng || 0, destLat, destLng);
      }

      const trackingLink = buildPublicMoveTrackUrl({
        id: move.id,
        move_code: (move as { move_code?: string | null }).move_code,
      });

      if (smsEnabled) {
        const tier = move.tier_selected || "";
        if (tier === "estate" && move.dedicated_coordinator) {
          await admin.from("in_app_notifications").insert({
            user_id: move.dedicated_coordinator,
            event_slug: "crew_departed",
            title: "Crew departed, send personal text",
            body: `${move.client_name} · ETA ~${etaMinutes} min. Send them a personal update.`,
            icon: "truck",
            link: `/admin/moves/${move.id}`,
            source_type: "move",
            source_id: move.id,
          });
        } else {
          const msg = buildETAMessage("crew_departed", {
            recipientName: move.client_name || "Customer",
            originAddress: move.from_address || "",
            destinationAddress: move.to_address || "",
            etaMinutes,
            trackingLink,
          });
          const sms = await sendSMS(move.client_phone, msg);
          await admin.from("eta_sms_log").insert({
            move_id: move.id,
            recipient_phone: move.client_phone,
            recipient_name: move.client_name || "",
            message_type: "crew_departed",
            message_body: msg,
            twilio_sid: sms.id || null,
            eta_minutes: etaMinutes,
            crew_lat: crewPos?.lat ?? null,
            crew_lng: crewPos?.lng ?? null,
            destination_lat: destLat || null,
            destination_lng: destLng || null,
          });
        }
      }

      return NextResponse.json({ ok: true, etaMinutes });
    }

    const { data: delivery } = await admin
      .from("deliveries")
      .select(
        "id, delivery_number, end_customer_name, end_customer_phone, customer_phone, pickup_address, delivery_address, delivery_lat, delivery_lng, organization_id, crew_id"
      )
      .eq("id", jobId)
      .maybeSingle();

    const recipientPhone = (
      (delivery?.end_customer_phone || delivery?.customer_phone || "") as string
    ).trim();
    if (!recipientPhone || !delivery?.crew_id) {
      return NextResponse.json({ ok: false, skipped: "no_phone_or_crew" });
    }

    let org: { name: string | null; customer_notifications_enabled: boolean | null } | null = null;
    if (delivery.organization_id) {
      const { data: o } = await admin
        .from("organizations")
        .select("name, customer_notifications_enabled")
        .eq("id", delivery.organization_id)
        .maybeSingle();
      org = o;
      if (!org?.customer_notifications_enabled && smsEnabled) {
        return NextResponse.json({ ok: false, skipped: "partner_disabled" });
      }
    }
    // B2B one-off / no org yet: treat as client-facing job — do not require partner notification toggle

    const { data: crewPos } = await admin
      .from("crew_locations")
      .select("lat, lng")
      .eq("crew_id", delivery.crew_id)
      .maybeSingle();

    const destLat = delivery.delivery_lat ?? 0;
    const destLng = delivery.delivery_lng ?? 0;
    const crewLat = crewPos?.lat ? Number(crewPos.lat) : 0;
    const crewLng = crewPos?.lng ? Number(crewPos.lng) : 0;

    let etaMinutes = 30;
    if (destLat && destLng && (crewLat || crewLng)) {
      etaMinutes = await getETAMinutes(crewLat || 0, crewLng || 0, destLat, destLng);
    }

    const trackingLink = buildPublicDeliveryTrackUrl({
      id: delivery.id,
      delivery_number: (delivery as { delivery_number?: string | null })
        .delivery_number,
    });
    const partnerName = org?.name || "";

    const canSendDeliveryEta =
      smsEnabled &&
      (delivery.organization_id ? !!org?.customer_notifications_enabled : true);

    if (canSendDeliveryEta) {
      const msg = buildETAMessage("crew_departed", {
        recipientName: delivery.end_customer_name || "Customer",
        originAddress: delivery.pickup_address || "",
        destinationAddress: delivery.delivery_address || "",
        etaMinutes,
        trackingLink,
        partnerName,
      });
      const sms = await sendSMS(recipientPhone, msg);
      await admin.from("eta_sms_log").insert({
        delivery_id: delivery.id,
        recipient_phone: recipientPhone,
        recipient_name: delivery.end_customer_name || "",
        message_type: "crew_departed",
        message_body: msg,
        twilio_sid: sms.id || null,
        eta_minutes: etaMinutes,
        crew_lat: crewPos?.lat ?? null,
        crew_lng: crewPos?.lng ?? null,
        destination_lat: destLat || null,
        destination_lng: destLng || null,
      });
    }

    return NextResponse.json({ ok: true, etaMinutes });
  } catch (error) {
    console.error("Send departure error:", error);
    return NextResponse.json({ error: "Send departure failed" }, { status: 500 });
  }
}
