import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getTodayString } from "@/lib/business-timezone";

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

export async function GET() {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();
  const admin = createAdminClient();

  // Only show deliveries on the live map when they are:
  //   1. Scheduled for TODAY (not days in the future)
  //   2. Confirmed, accepted, or already in progress — not still pending approval
  const todayStr = getTodayString();
  const liveStatuses = ["confirmed", "accepted", "dispatched", "in-transit", "in_transit", "in_progress"];

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("id, delivery_number, customer_name, status, delivery_address, crew_id")
    .eq("organization_id", orgId!)
    .eq("scheduled_date", todayStr)
    .in("status", liveStatuses)
    .order("scheduled_date", { ascending: true });

  if (!deliveries || deliveries.length === 0) {
    return NextResponse.json({ deliveries: [] });
  }

  const crewIds = [...new Set(deliveries.map((d) => d.crew_id).filter(Boolean))] as string[];

  let crewMap: Record<string, { name: string; current_lat: number | null; current_lng: number | null }> = {};
  if (crewIds.length > 0) {
    const { data: crews } = await admin
      .from("crews")
      .select("id, name, current_lat, current_lng")
      .in("id", crewIds);

    // Also check crew_locations for fresher GPS data
    const { data: crewLocs } = await admin
      .from("crew_locations")
      .select("crew_id, lat, lng, crew_name")
      .in("crew_id", crewIds);

    const locMap: Record<string, { lat: number; lng: number; name: string | null }> = {};
    (crewLocs || []).forEach((cl) => {
      if (cl.lat != null && cl.lng != null) {
        locMap[cl.crew_id] = { lat: cl.lat, lng: cl.lng, name: cl.crew_name };
      }
    });

    (crews || []).forEach((c) => {
      const freshLoc = locMap[c.id];
      crewMap[c.id] = {
        name: c.name,
        current_lat: freshLoc?.lat ?? c.current_lat,
        current_lng: freshLoc?.lng ?? c.current_lng,
      };
    });
  }

  const deliveryIds = deliveries.map((d) => d.id);
  let sessionMap: Record<string, { live_stage: string | null }> = {};
  if (deliveryIds.length > 0) {
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("job_id, status, is_active")
      .in("job_id", deliveryIds)
      .eq("job_type", "delivery")
      .eq("is_active", true);

    (sessions || []).forEach((s) => {
      sessionMap[s.job_id] = { live_stage: s.status };
    });
  }

  // Geocode delivery addresses in parallel for destination markers
  const geocodePromises = deliveries.map(async (d) => {
    if (d.delivery_address) {
      return geocodeAddress(d.delivery_address);
    }
    return null;
  });
  const geocoded = await Promise.all(geocodePromises);

  const enriched = deliveries.map((d, i) => {
    const crew = d.crew_id ? crewMap[d.crew_id] : null;
    const session = sessionMap[d.id];
    const destCoords = geocoded[i];
    return {
      id: d.id,
      delivery_number: d.delivery_number,
      customer_name: d.customer_name,
      status: d.status,
      delivery_address: d.delivery_address,
      crew_id: d.crew_id,
      crew_name: crew?.name || null,
      crew_lat: crew?.current_lat || null,
      crew_lng: crew?.current_lng || null,
      dest_lat: destCoords?.lat || null,
      dest_lng: destCoords?.lng || null,
      live_stage: session?.live_stage || null,
    };
  });

  return NextResponse.json({ deliveries: enriched });
}
