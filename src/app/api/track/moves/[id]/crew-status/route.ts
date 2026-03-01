import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/** Haversine distance in km */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
      .select("id, crew_id, from_lat, from_lng, to_lat, to_lng, stage, scheduled_date, status, arrival_window")
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
    } else if (move.crew_id) {
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

    const center =
      move.from_lat != null && move.from_lng != null
        ? { lat: move.from_lat, lng: move.from_lng }
        : { lat: 43.665, lng: -79.385 };

    const pickup =
      move.from_lat != null && move.from_lng != null
        ? { lat: move.from_lat, lng: move.from_lng }
        : null;
    const dropoff =
      move.to_lat != null && move.to_lng != null
        ? { lat: move.to_lat, lng: move.to_lng }
        : null;

    // Compute ETA (minutes) when crew has position and destination
    let etaMinutes: number | null = null;
    const enRouteStages = ["en_route_to_pickup", "en_route_to_destination", "on_route", "en_route"];
    if (
      crew &&
      (ts?.is_active || liveStage) &&
      enRouteStages.includes(liveStage || "")
    ) {
      const dest =
        liveStage === "en_route_to_pickup" ? pickup : dropoff ?? pickup;
      if (dest) {
        const km = haversineKm(
          crew.current_lat,
          crew.current_lng,
          dest.lat,
          dest.lng
        );
        const avgSpeedKmh = 35;
        etaMinutes = Math.max(1, Math.round((km / avgSpeedKmh) * 60));
      }
    }

    return NextResponse.json(
      {
        crew,
        center,
        pickup,
        dropoff,
        liveStage,
        lastLocationAt,
        etaMinutes,
        hasActiveTracking: !!ts?.is_active,
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
