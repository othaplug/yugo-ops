import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";

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
      ? await admin.from("deliveries").select("id, crew_id, stage").eq("id", slug).single()
      : await admin.from("deliveries").select("id, crew_id, stage").ilike("delivery_number", slug).single();

    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (!verifyTrackToken("delivery", delivery.id, token)) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    let crew: { current_lat: number; current_lng: number; name: string } | null = null;
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

    if (ts?.last_location && typeof ts.last_location === "object" && "lat" in ts.last_location && "lng" in ts.last_location) {
      const loc = ts.last_location as { lat: number; lng: number };
      crew = { current_lat: loc.lat, current_lng: loc.lng, name: "Crew" };
      liveStage = ts.status || liveStage;
    } else if (delivery.crew_id) {
      const { data: c } = await admin
        .from("crews")
        .select("current_lat, current_lng, name")
        .eq("id", delivery.crew_id)
        .single();
      if (c && c.current_lat != null && c.current_lng != null) {
        crew = { current_lat: c.current_lat, current_lng: c.current_lng, name: c.name || "Crew" };
      }
    }

    const center = crew
      ? { lat: crew.current_lat, lng: crew.current_lng }
      : { lat: 43.665, lng: -79.385 };

    return NextResponse.json(
      { crew, center, liveStage, hasActiveTracking: !!ts?.is_active },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
