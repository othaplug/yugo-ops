import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { buildETAMessage } from "@/lib/sms/etaMessages";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const GPS_STALE_MS = 5 * 60 * 1000;
const ARRIVAL_RADIUS_M = 100;

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getETAMinutes(
  crewLat: number,
  crewLng: number,
  destLat: number,
  destLng: number
): Promise<number> {
  if (!MAPBOX_TOKEN) return 999;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${crewLng},${crewLat};${destLng},${destLat}?access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.routes?.[0]?.duration) {
    return Math.ceil(data.routes[0].duration / 60);
  }
  return 999;
}

export async function runEtaCheck(): Promise<{ processed: number; results: unknown[] }> {
  const admin = createAdminClient();
  const cfg = await getFeatureConfig(["sms_eta_enabled"]);
  const smsEnabled = cfg.sms_eta_enabled === "true";
  const baseUrl = getEmailBaseUrl();
  const results: unknown[] = [];

  const { data: activeMoves } = await admin
    .from("moves")
    .select(
      "id, client_name, client_phone, from_address, to_address, to_lat, to_lng, tracking_code, tier_selected, dedicated_coordinator, crew_id"
    )
    .eq("eta_tracking_active", true)
    .in("status", ["in_progress", "en_route"]);

  const { data: activeDeliveries } = await admin
    .from("deliveries")
    .select(
      "id, end_customer_name, end_customer_phone, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, stage, tracking_code, organization_id, crew_id"
    )
    .eq("eta_tracking_active", true)
    .in("status", ["in_progress", "en_route"]);

  for (const move of activeMoves || []) {
    if (!move.client_phone || !move.crew_id) continue;

    const { data: crewPos } = await admin
      .from("crew_locations")
      .select("lat, lng, updated_at")
      .eq("crew_id", move.crew_id)
      .maybeSingle();

    if (!crewPos?.lat || !crewPos?.lng) continue;

    const gpsAge = Date.now() - new Date(crewPos.updated_at || 0).getTime();
    if (gpsAge > GPS_STALE_MS) continue;

    const destLat = move.to_lat ?? 0;
    const destLng = move.to_lng ?? 0;
    if (!destLat || !destLng) continue;

    const etaMinutes = await getETAMinutes(
      Number(crewPos.lat),
      Number(crewPos.lng),
      destLat,
      destLng
    );

    await admin
      .from("moves")
      .update({
        eta_current_minutes: etaMinutes,
        eta_last_checked_at: new Date().toISOString(),
      })
      .eq("id", move.id);

    const trackingLink = `${baseUrl}/track/move/${move.tracking_code ?? move.id}?token=${signTrackToken("move", move.id)}`;

    if (smsEnabled && etaMinutes <= 15 && etaMinutes > 0) {
      const { data: existing15 } = await admin
        .from("eta_sms_log")
        .select("id")
        .eq("move_id", move.id)
        .eq("message_type", "eta_15_min")
        .limit(1);

      if (!existing15?.length) {
        const tier = move.tier_selected || "";
        if (tier === "estate" && move.dedicated_coordinator) {
          await admin.from("in_app_notifications").insert({
            user_id: move.dedicated_coordinator,
            event_slug: "eta_15_min",
            title: "Crew is 15 min away — send personal text",
            body: `${move.client_name} · ${etaMinutes} min ETA. Send them a personal update.`,
            icon: "📍",
            link: `/admin/moves/${move.id}`,
            source_type: "move",
            source_id: move.id,
          });
        } else {
          const msg = buildETAMessage("eta_15_min", {
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
            message_type: "eta_15_min",
            message_body: msg,
            twilio_sid: sms.sid || null,
            eta_minutes: etaMinutes,
            crew_lat: crewPos.lat,
            crew_lng: crewPos.lng,
            destination_lat: destLat,
            destination_lng: destLng,
          });
        }
        results.push({ move_id: move.id, action: "eta_15_min_sent" });
      }
    }

    const distM = calculateDistance(
      Number(crewPos.lat),
      Number(crewPos.lng),
      destLat,
      destLng
    );

    const { data: existingArrived } = await admin
      .from("eta_sms_log")
      .select("id")
      .eq("move_id", move.id)
      .eq("message_type", "crew_arrived")
      .limit(1);

    if (distM <= ARRIVAL_RADIUS_M && !existingArrived?.length && smsEnabled) {
      const tier = move.tier_selected || "";
      if (tier !== "estate") {
        const msg = buildETAMessage("crew_arrived", {
          recipientName: move.client_name || "Customer",
          originAddress: move.from_address || "",
          destinationAddress: move.to_address || "",
          etaMinutes: 0,
          trackingLink,
        });
        const sms = await sendSMS(move.client_phone, msg);
        await admin.from("eta_sms_log").insert({
          move_id: move.id,
          recipient_phone: move.client_phone,
          recipient_name: move.client_name || "",
          message_type: "crew_arrived",
          message_body: msg,
          twilio_sid: sms.sid || null,
          eta_minutes: 0,
          crew_lat: crewPos.lat,
          crew_lng: crewPos.lng,
          destination_lat: destLat,
          destination_lng: destLng,
        });
      }
      results.push({ move_id: move.id, action: "crew_arrived_sent" });
    }

    const { data: existingProgress } = await admin
      .from("eta_sms_log")
      .select("id")
      .eq("move_id", move.id)
      .eq("message_type", "in_progress")
      .limit(1);

    const { data: arrivedLog } = await admin
      .from("eta_sms_log")
      .select("sent_at")
      .eq("move_id", move.id)
      .eq("message_type", "crew_arrived")
      .limit(1)
      .maybeSingle();

    if (
      arrivedLog &&
      !existingProgress?.length &&
      smsEnabled
    ) {
      const timeSince = Date.now() - new Date(arrivedLog.sent_at).getTime();
      if (timeSince >= 30 * 60 * 1000) {
        const msg = buildETAMessage("in_progress", {
          recipientName: move.client_name || "Customer",
          originAddress: move.from_address || "",
          destinationAddress: move.to_address || "",
          etaMinutes: 0,
          trackingLink,
        });
        const sms = await sendSMS(move.client_phone, msg);
        await admin.from("eta_sms_log").insert({
          move_id: move.id,
          recipient_phone: move.client_phone,
          recipient_name: move.client_name || "",
          message_type: "in_progress",
          message_body: msg,
          twilio_sid: sms.sid || null,
          eta_minutes: etaMinutes,
          crew_lat: crewPos.lat,
          crew_lng: crewPos.lng,
          destination_lat: destLat,
          destination_lng: destLng,
        });
        results.push({ move_id: move.id, action: "in_progress_sent" });
      }
    }
  }

  for (const delivery of activeDeliveries || []) {
    if (!delivery.end_customer_phone || !delivery.crew_id) continue;

    const { data: org } = await admin
      .from("organizations")
      .select("name, customer_notifications_enabled")
      .eq("id", delivery.organization_id)
      .maybeSingle();

    if (!org?.customer_notifications_enabled) continue;

    const { data: crewPos } = await admin
      .from("crew_locations")
      .select("lat, lng, updated_at")
      .eq("crew_id", delivery.crew_id)
      .maybeSingle();

    if (!crewPos?.lat || !crewPos?.lng) continue;

    const gpsAge = Date.now() - new Date(crewPos.updated_at || 0).getTime();
    if (gpsAge > GPS_STALE_MS) continue;

    const destLat = delivery.delivery_lat ?? 0;
    const destLng = delivery.delivery_lng ?? 0;
    if (!destLat || !destLng) continue;

    const isPrePickup = delivery.stage === "en_route_to_pickup" || delivery.stage === "en_route";
    const pickupLat = delivery.pickup_lat != null ? Number(delivery.pickup_lat) : null;
    const pickupLng = delivery.pickup_lng != null ? Number(delivery.pickup_lng) : null;

    let etaMinutes: number;
    if (isPrePickup && pickupLat != null && pickupLng != null) {
      const [leg1, leg2] = await Promise.all([
        getETAMinutes(Number(crewPos.lat), Number(crewPos.lng), pickupLat, pickupLng),
        getETAMinutes(pickupLat, pickupLng, destLat, destLng),
      ]);
      etaMinutes = leg1 + 15 + leg2;
    } else {
      etaMinutes = await getETAMinutes(
        Number(crewPos.lat),
        Number(crewPos.lng),
        destLat,
        destLng
      );
    }

    await admin
      .from("deliveries")
      .update({
        eta_current_minutes: etaMinutes,
        eta_last_checked_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    const trackingLink = `${baseUrl}/track/delivery/${encodeURIComponent(delivery.tracking_code || delivery.id)}?token=${signTrackToken("delivery", delivery.id)}`;
    const partnerName = org?.name || "";

    if (smsEnabled && etaMinutes <= 15 && etaMinutes > 0) {
      const { data: existing15 } = await admin
        .from("eta_sms_log")
        .select("id")
        .eq("delivery_id", delivery.id)
        .eq("message_type", "eta_15_min")
        .limit(1);

      if (!existing15?.length) {
        const msg = buildETAMessage("eta_15_min", {
          recipientName: delivery.end_customer_name || "Customer",
          originAddress: delivery.pickup_address || "",
          destinationAddress: delivery.delivery_address || "",
          etaMinutes,
          trackingLink,
          partnerName,
        });
        const sms = await sendSMS(delivery.end_customer_phone, msg);
        await admin.from("eta_sms_log").insert({
          delivery_id: delivery.id,
          recipient_phone: delivery.end_customer_phone,
          recipient_name: delivery.end_customer_name || "",
          message_type: "eta_15_min",
          message_body: msg,
          twilio_sid: sms.sid || null,
          eta_minutes: etaMinutes,
          crew_lat: crewPos.lat,
          crew_lng: crewPos.lng,
          destination_lat: destLat,
          destination_lng: destLng,
        });
        results.push({ delivery_id: delivery.id, action: "eta_15_min_sent" });
      }
    }

    const distM = calculateDistance(
      Number(crewPos.lat),
      Number(crewPos.lng),
      destLat,
      destLng
    );

    const { data: existingArrived } = await admin
      .from("eta_sms_log")
      .select("id")
      .eq("delivery_id", delivery.id)
      .eq("message_type", "crew_arrived")
      .limit(1);

    if (distM <= ARRIVAL_RADIUS_M && !existingArrived?.length && smsEnabled) {
      const msg = buildETAMessage("crew_arrived", {
        recipientName: delivery.end_customer_name || "Customer",
        originAddress: delivery.pickup_address || "",
        destinationAddress: delivery.delivery_address || "",
        etaMinutes: 0,
        trackingLink,
        partnerName,
      });
      const sms = await sendSMS(delivery.end_customer_phone, msg);
      await admin.from("eta_sms_log").insert({
        delivery_id: delivery.id,
        recipient_phone: delivery.end_customer_phone,
        recipient_name: delivery.end_customer_name || "",
        message_type: "crew_arrived",
        message_body: msg,
        twilio_sid: sms.sid || null,
        eta_minutes: 0,
        crew_lat: crewPos.lat,
        crew_lng: crewPos.lng,
        destination_lat: destLat,
        destination_lng: destLng,
      });
      results.push({ delivery_id: delivery.id, action: "crew_arrived_sent" });
    }
  }

  return { processed: results.length, results };
}

export async function POST(req: NextRequest) {
  try {
    const { processed, results } = await runEtaCheck();
    return NextResponse.json({ processed, results });
  } catch (error) {
    console.error("ETA check error:", error);
    return NextResponse.json({ error: "ETA check failed" }, { status: 500 });
  }
}
