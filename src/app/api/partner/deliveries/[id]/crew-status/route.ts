import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { isUuid } from "@/lib/move-code";

/** Partner-scoped crew status for a delivery. Returns liveStage, crew position. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await admin.from("deliveries").select("id, crew_id, stage, organization_id").eq("id", slug).single()
    : await admin.from("deliveries").select("id, crew_id, stage, organization_id").ilike("delivery_number", slug).single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (delivery.organization_id !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const crew_lat = crew?.current_lat ?? null;
  const crew_lng = crew?.current_lng ?? null;

  let pickup: { lat: number; lng: number } | null = null;
  let dropoff: { lat: number; lng: number } | null = null;
  const { data: addr } = await admin
    .from("deliveries")
    .select("pickup_address, delivery_address")
    .eq("id", delivery.id)
    .single();
  if (addr?.pickup_address || addr?.delivery_address) {
    const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
    if (MAPBOX_TOKEN && addr.pickup_address) {
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addr.pickup_address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
        const j = await r.json();
        const c = j?.features?.[0]?.center;
        if (c) pickup = { lng: c[0], lat: c[1] };
      } catch {}
    }
    if (MAPBOX_TOKEN && addr.delivery_address) {
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addr.delivery_address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
        const j = await r.json();
        const c = j?.features?.[0]?.center;
        if (c) dropoff = { lng: c[0], lat: c[1] };
      } catch {}
    }
  }

  return NextResponse.json(
    {
      crew,
      crew_lat: crew_lat ?? undefined,
      crew_lng: crew_lng ?? undefined,
      liveStage,
      hasActiveTracking: !!ts?.is_active,
      pickup: pickup ?? undefined,
      dropoff: dropoff ?? undefined,
      center: pickup ? { lat: pickup.lat, lng: pickup.lng } : dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : { lat: 43.665, lng: -79.385 },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
