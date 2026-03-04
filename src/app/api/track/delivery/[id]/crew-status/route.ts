import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isUuid } from "@/lib/move-code";

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
      ? await admin.from("deliveries").select("id, crew_id, stage, pickup_address, delivery_address, scheduled_date, time_slot, delivery_window").eq("id", slug).single()
      : await admin.from("deliveries").select("id, crew_id, stage, pickup_address, delivery_address, scheduled_date, time_slot, delivery_window").ilike("delivery_number", slug).single();

    if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    if (!verifyTrackToken("delivery", delivery.id, token)) {
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

    if (delivery.crew_id) {
      const { data: c } = await admin
        .from("crews")
        .select("current_lat, current_lng, name")
        .eq("id", delivery.crew_id)
        .single();
      if (c) crewName = c.name || "Crew";

      if (ts?.last_location && typeof ts.last_location === "object" && "lat" in ts.last_location && "lng" in ts.last_location) {
        const loc = ts.last_location as { lat: number; lng: number };
        crew = { current_lat: loc.lat, current_lng: loc.lng, name: crewName || "Crew" };
        liveStage = ts.status || liveStage;
      } else if (c && c.current_lat != null && c.current_lng != null) {
        crew = { current_lat: c.current_lat, current_lng: c.current_lng, name: c.name || "Crew" };
      }
    }

    const center = crew
      ? { lat: crew.current_lat, lng: crew.current_lng }
      : { lat: 43.665, lng: -79.385 };

    const [pickup, dropoff] = await Promise.all([
      delivery.pickup_address ? geocodeAddress(delivery.pickup_address) : null,
      delivery.delivery_address ? geocodeAddress(delivery.delivery_address) : null,
    ]);

    return NextResponse.json(
      {
        crew,
        crewName,
        center,
        liveStage,
        hasActiveTracking: !!ts?.is_active,
        pickup,
        dropoff,
        scheduledDate: delivery.scheduled_date || null,
        timeWindow: delivery.delivery_window || delivery.time_slot || null,
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
