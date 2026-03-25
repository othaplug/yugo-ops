import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { isUuid } from "@/lib/move-code";

/** Partner-scoped crew status for a delivery. Returns liveStage, crew position. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const slug = decodeURIComponent((await params).id?.trim() || "");
  const admin = createAdminClient();

  const byUuid = isUuid(slug);
  const { data: delivery } = byUuid
    ? await admin
        .from("deliveries")
        .select(
          "id, crew_id, stage, organization_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_address, delivery_address"
        )
        .eq("id", slug)
        .single()
    : await admin
        .from("deliveries")
        .select(
          "id, crew_id, stage, organization_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng, pickup_address, delivery_address"
        )
        .ilike("delivery_number", slug)
        .single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  if (!delivery.organization_id || !orgIds.includes(delivery.organization_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let crewDisplayName = "Crew";
  if (delivery.crew_id) {
    const { data: crow } = await admin.from("crews").select("name").eq("id", delivery.crew_id).maybeSingle();
    if (crow?.name?.trim()) crewDisplayName = crow.name.trim();
  }

  let crew: { current_lat: number; current_lng: number; name: string } | null = null;
  let liveStage: string | null = delivery.stage || null;
  let isNavigating = false;
  let navEtaSeconds: number | null = null;
  let navDistanceRemainingM: number | null = null;

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
    crew = { current_lat: loc.lat, current_lng: loc.lng, name: crewDisplayName };
    liveStage = ts.status || liveStage;
  } else if (delivery.crew_id) {
    const { data: c } = await admin
      .from("crews")
      .select("current_lat, current_lng, name")
      .eq("id", delivery.crew_id)
      .single();
    if (c && c.current_lat != null && c.current_lng != null) {
      crew = { current_lat: c.current_lat, current_lng: c.current_lng, name: c.name || crewDisplayName };
    }
  }

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

  const crew_lat = crew?.current_lat ?? null;
  const crew_lng = crew?.current_lng ?? null;

  let pickup: { lat: number; lng: number } | null =
    delivery.pickup_lat != null && delivery.pickup_lng != null
      ? { lat: Number(delivery.pickup_lat), lng: Number(delivery.pickup_lng) }
      : null;
  let dropoff: { lat: number; lng: number } | null =
    delivery.delivery_lat != null && delivery.delivery_lng != null
      ? { lat: Number(delivery.delivery_lat), lng: Number(delivery.delivery_lng) }
      : null;
  const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  if (!pickup && MAPBOX_TOKEN && delivery.pickup_address) {
    try {
      const r = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(delivery.pickup_address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const j = await r.json();
      const c = j?.features?.[0]?.center;
      if (c) pickup = { lng: c[0], lat: c[1] };
    } catch {}
  }
  if (!dropoff && MAPBOX_TOKEN && delivery.delivery_address) {
    try {
      const r = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(delivery.delivery_address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
      );
      const j = await r.json();
      const c = j?.features?.[0]?.center;
      if (c) dropoff = { lng: c[0], lat: c[1] };
    } catch {}
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
      is_navigating: isNavigating,
      nav_eta_seconds: navEtaSeconds,
      nav_distance_remaining_m: navDistanceRemainingM,
      crew_name: crewDisplayName,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
