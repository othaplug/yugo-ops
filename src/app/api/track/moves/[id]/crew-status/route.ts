import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

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

    return NextResponse.json(
      {
        crew,
        center,
        pickup,
        dropoff,
        liveStage,
        lastLocationAt,
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
