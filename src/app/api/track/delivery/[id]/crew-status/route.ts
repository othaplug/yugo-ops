import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDeliveryTrackAccess } from "@/lib/delivery-tracking-tokens";
import { isUuid } from "@/lib/move-code";
import { getDispatchPhone } from "@/lib/config";
import { buildClientMainStepCompletedAt } from "@/lib/delivery-track-stage-times";

/** Public track: show assigned crew member names only — never internal team labels (e.g. Team Alpha). */
function clientFacingDeliveryCrewNames(assignedMembers: unknown): string | null {
  const names = Array.isArray(assignedMembers)
    ? assignedMembers
        .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
        .map((n) => n.trim())
    : [];
  if (names.length === 0) return null;
  return names.join(", ");
}

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat?.center) return { lng: feat.center[0], lat: feat.center[1] };
  } catch {}
  return null;
}

const PICKUP_LOAD_BUFFER_MINUTES = 15;

async function getMapboxDrivingEtaMinutes(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<number | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?access_token=${MAPBOX_TOKEN}&overview=false`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = await res.json();
    const durationSec = data?.routes?.[0]?.duration;
    if (typeof durationSec === "number" && durationSec > 0) {
      return Math.max(1, Math.round(durationSec / 60));
    }
  } catch {}
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const token = req.nextUrl.searchParams.get("token") || "";

  try {
    const admin = createAdminClient();
    const byUuid = isUuid(slug);
    const { data: delivery } = byUuid
      ? await admin
          .from("deliveries")
          .select(
            "id, crew_id, assigned_members, stage, completed_at, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, scheduled_date, time_slot, delivery_window, eta_current_minutes",
          )
          .eq("id", slug)
          .single()
      : await admin
          .from("deliveries")
          .select(
            "id, crew_id, assigned_members, stage, completed_at, pickup_address, delivery_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, scheduled_date, time_slot, delivery_window, eta_current_minutes",
          )
          .ilike("delivery_number", slug)
          .single();

    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    const ok = await verifyDeliveryTrackAccess(delivery.id, token);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    let crew: { current_lat: number; current_lng: number; name: string } | null = null;
    let crewName: string | null = null;
    let liveStage: string | null = delivery.stage || null;

    const { data: ts } = await admin
      .from("tracking_sessions")
      .select("status, last_location, is_active")
      .eq("job_id", delivery.id)
      .eq("job_type", "delivery")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: timelineSession } = await admin
      .from("tracking_sessions")
      .select("checkpoints")
      .eq("job_id", delivery.id)
      .eq("job_type", "delivery")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stepCompletedAt = buildClientMainStepCompletedAt(timelineSession?.checkpoints, delivery.completed_at);

    let isNavigating = false;
    let navEtaSeconds: number | null = null;
    let navDistanceRemainingM: number | null = null;
    if (delivery.crew_id && ts?.is_active) {
      const { data: cl } = await admin
        .from("crew_locations")
        .select("is_navigating, nav_eta_seconds, nav_distance_remaining_m")
        .eq("crew_id", delivery.crew_id)
        .maybeSingle();
      if (cl) {
        isNavigating = Boolean(cl.is_navigating);
        if (cl.nav_eta_seconds != null) navEtaSeconds = Math.round(Number(cl.nav_eta_seconds));
        if (cl.nav_distance_remaining_m != null) navDistanceRemainingM = Math.round(Number(cl.nav_distance_remaining_m));
      }
    }

    const clientCrewLabel = clientFacingDeliveryCrewNames(delivery.assigned_members);

    if (delivery.crew_id) {
      const { data: c } = await admin
        .from("crews")
        .select("current_lat, current_lng")
        .eq("id", delivery.crew_id)
        .single();
      crewName = clientCrewLabel;

      if (ts?.last_location && typeof ts.last_location === "object" && "lat" in ts.last_location && "lng" in ts.last_location) {
        const loc = ts.last_location as { lat: number; lng: number };
        const markerName = clientCrewLabel || "Crew";
        crew = { current_lat: loc.lat, current_lng: loc.lng, name: markerName };
        liveStage = ts.status || liveStage;
      } else if (c && c.current_lat != null && c.current_lng != null) {
        const markerName = clientCrewLabel || "Crew";
        crew = { current_lat: c.current_lat, current_lng: c.current_lng, name: markerName };
      }
    }

    // Resolve crew phone: truck.phone (stable) > registered_devices.phone > crews.phone > dispatch
    let crewPhone: string | null = null;
    if (delivery.crew_id) {
      const { data: device } = await admin
        .from("registered_devices")
        .select("truck_id, phone")
        .eq("default_team_id", delivery.crew_id)
        .eq("is_active", true)
        .order("last_active_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (device?.truck_id) {
        const { data: fv } = await admin
          .from("fleet_vehicles")
          .select("phone")
          .eq("id", device.truck_id)
          .maybeSingle();
        if (fv?.phone) crewPhone = fv.phone;
      }
      if (!crewPhone && device?.phone) crewPhone = device.phone;
      if (!crewPhone) {
        const { data: crewRow } = await admin
          .from("crews")
          .select("phone")
          .eq("id", delivery.crew_id)
          .maybeSingle();
        if (crewRow?.phone) crewPhone = crewRow.phone;
      }
    }
    const dispatchPhone = await getDispatchPhone();

    const center = crew
      ? { lat: crew.current_lat, lng: crew.current_lng }
      : { lat: 43.665, lng: -79.385 };

    let pickup =
      delivery.pickup_lat != null && delivery.pickup_lng != null
        ? { lat: Number(delivery.pickup_lat), lng: Number(delivery.pickup_lng) }
        : null;
    let dropoff =
      delivery.delivery_lat != null && delivery.delivery_lng != null
        ? { lat: Number(delivery.delivery_lat), lng: Number(delivery.delivery_lng) }
        : null;
    if (!pickup && delivery.pickup_address) pickup = await geocodeAddress(delivery.pickup_address);
    if (!dropoff && delivery.delivery_address) dropoff = await geocodeAddress(delivery.delivery_address);

    const isPrePickup = liveStage === "en_route_to_pickup" || liveStage === "en_route";
    let etaMinutes: number | null = delivery?.eta_current_minutes ?? null;
    if (isPrePickup && crew && pickup && dropoff) {
      const [leg1, leg2] = await Promise.all([
        getMapboxDrivingEtaMinutes(crew.current_lat, crew.current_lng, pickup.lat, pickup.lng),
        getMapboxDrivingEtaMinutes(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng),
      ]);
      if (leg1 != null && leg2 != null) {
        etaMinutes = leg1 + PICKUP_LOAD_BUFFER_MINUTES + leg2;
      }
    }

    return NextResponse.json(
      {
        crew,
        crewName,
        center,
        liveStage,
        hasActiveTracking: !!ts?.is_active,
        crewPhone: crewPhone || null,
        dispatchPhone,
        pickup,
        dropoff,
        scheduledDate: delivery.scheduled_date || null,
        timeWindow: delivery.delivery_window || delivery.time_slot || null,
        eta_current_minutes: etaMinutes,
        stepCompletedAt,
        is_navigating: isNavigating,
        nav_eta_seconds: navEtaSeconds,
        nav_distance_remaining_m: navDistanceRemainingM,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
