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
      .select("id, crew_id, from_lat, from_lng, to_lat, to_lng, stage")
      .eq("id", moveId)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    let crew: { current_lat: number; current_lng: number; name: string } | null = null;
    if (move.crew_id) {
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
        liveStage: move.stage || null,
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
