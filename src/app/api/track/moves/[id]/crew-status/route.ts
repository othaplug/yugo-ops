import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { getDispatchPhone } from "@/lib/config";

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!MAPBOX_TOKEN || !address?.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address.trim())}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat?.center) return { lat: feat.center[1], lng: feat.center[0] };
  } catch {}
  return null;
}

async function getMapboxDrivingEta(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<number | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&overview=false`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    const data = await res.json();
    const durationSec = data?.routes?.[0]?.duration;
    if (typeof durationSec === "number" && durationSec > 0) {
      return Math.max(1, Math.round(durationSec / 60));
    }
  } catch {}
  return null;
}

function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: move } = await admin
      .from("moves")
      .select("id, crew_id, from_lat, from_lng, to_lat, to_lng, from_address, to_address, stage, scheduled_date, status, arrival_window, eta_current_minutes")
      .eq("id", moveId)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    let crew: { current_lat: number; current_lng: number; name: string } | null = null;
    let liveStage: string | null = move.stage || null;
    let lastLocationAt: string | null = null;

    // Prefer tracking_sessions (crew portal) over crews table
    const { data: ts } = await admin
      .from("tracking_sessions")
      .select("status, last_location, is_active")
      .eq("job_id", moveId)
      .eq("job_type", "move")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ts?.last_location && typeof ts.last_location === "object" && "lat" in ts.last_location && "lng" in ts.last_location) {
      const loc = ts.last_location as { lat: number; lng: number; timestamp?: string };
      crew = {
        current_lat: loc.lat,
        current_lng: loc.lng,
        name: "Crew",
      };
      liveStage = ts.status || liveStage;
      lastLocationAt = loc.timestamp || null;
    }

    // Fallback: check crew_locations table (gets freshest GPS data from watchPosition)
    if (!crew && move.crew_id) {
      const { data: cl } = await admin
        .from("crew_locations")
        .select("lat, lng, updated_at, crew_name, status")
        .eq("crew_id", move.crew_id)
        .maybeSingle();
      if (cl && cl.lat != null && cl.lng != null) {
        crew = { current_lat: cl.lat, current_lng: cl.lng, name: cl.crew_name || "Crew" };
        lastLocationAt = cl.updated_at || null;
      }
    }

    // Final fallback: crews table
    if (!crew && move.crew_id) {
      const { data: c } = await admin
        .from("crews")
        .select("current_lat, current_lng, name")
        .eq("id", move.crew_id)
        .single();
      if (c && c.current_lat != null && c.current_lng != null) {
        crew = {
          current_lat: c.current_lat,
          current_lng: c.current_lng,
          name: c.name || "Crew",
        };
      }
    }

    // Resolve crew phone: truck.phone (stable) > registered_devices.phone > crews.phone > dispatch
    let crewPhone: string | null = null;
    if (move.crew_id) {
      const { data: device } = await admin
        .from("registered_devices")
        .select("truck_id, phone")
        .eq("default_team_id", move.crew_id)
        .eq("is_active", true)
        .order("last_active_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (device?.truck_id) {
        const { data: truck } = await admin
          .from("trucks")
          .select("phone")
          .eq("id", device.truck_id)
          .maybeSingle();
        if (truck?.phone) crewPhone = truck.phone;
      }
      if (!crewPhone && device?.phone) crewPhone = device.phone;
      if (!crewPhone) {
        const { data: crewRow } = await admin
          .from("crews")
          .select("phone")
          .eq("id", move.crew_id)
          .maybeSingle();
        if (crewRow?.phone) crewPhone = crewRow.phone;
      }
    }
    const dispatchPhone = await getDispatchPhone();

    let pickup: { lat: number; lng: number } | null =
      move.from_lat != null && move.from_lng != null
        ? { lat: move.from_lat, lng: move.from_lng }
        : null;
    if (!pickup && move.from_address) {
      pickup = await geocodeAddress(move.from_address);
    }

    const center = pickup ?? { lat: 43.665, lng: -79.385 };

    let dropoff: { lat: number; lng: number } | null =
      move.to_lat != null && move.to_lng != null
        ? { lat: move.to_lat, lng: move.to_lng }
        : null;
    if (!dropoff && move.to_address) {
      dropoff = await geocodeAddress(move.to_address);
    }

    // Compute ETA — use Mapbox Directions for actual driving time, Haversine as fallback
    let etaMinutes: number | null = null;
    const etaStages = [
      "en_route_to_pickup", "en_route_to_destination", "on_route", "en_route",
      "loading", "arrived_at_pickup",
    ];
    if (
      etaMinutes == null &&
      crew &&
      (ts?.is_active || liveStage) &&
      etaStages.includes(liveStage || "")
    ) {
      const toPickup = liveStage === "en_route_to_pickup";
      const dest = toPickup ? pickup : dropoff ?? pickup;
      if (dest) {
        etaMinutes = await getMapboxDrivingEta(
          crew.current_lat, crew.current_lng,
          dest.lat, dest.lng
        );
        if (etaMinutes == null) {
          const km = haversineKm(crew.current_lat, crew.current_lng, dest.lat, dest.lng);
          etaMinutes = Math.max(1, Math.round((km / 35) * 60));
        }
      }
    }

    // Show live map when: active tracking session, move status is in_progress, or move has a stage set (crew/admin started — so client always sees map once crew has begun)
    const moveInProgress = move?.status === "in_progress";
    const hasStageSet = liveStage != null && String(liveStage).trim() !== "" && liveStage !== "pending";
    const hasActiveTracking = !!ts?.is_active || !!moveInProgress || !!hasStageSet;

    return NextResponse.json(
      {
        crew,
        center,
        pickup,
        dropoff,
        liveStage,
        lastLocationAt,
        etaMinutes: etaMinutes ?? null,
        eta_current_minutes: move?.eta_current_minutes ?? null,
        hasActiveTracking,
        crewPhone: crewPhone || null,
        dispatchPhone,
        scheduled_date: move?.scheduled_date ?? null,
        status: move?.status ?? null,
        arrival_window: move?.arrival_window ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
