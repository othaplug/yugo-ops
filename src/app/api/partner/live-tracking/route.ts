import { NextResponse } from "next/server";
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

const PICKUP_STAGES = ["en_route_to_pickup", "arrived_at_pickup", "en_route", "on_route", "arrived", "arrived_on_site"];

type CrewRow = { name: string; current_lat: number | null; current_lng: number | null };

function buildCrewMap(crewIds: string[]): Promise<Record<string, CrewRow>> {
  if (crewIds.length === 0) return Promise.resolve({});
  const admin = createAdminClient();
  return (async () => {
    const { data: crews } = await admin
      .from("crews")
      .select("id, name, current_lat, current_lng")
      .in("id", crewIds);

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

    const crewMap: Record<string, CrewRow> = {};
    (crews || []).forEach((c) => {
      const freshLoc = locMap[c.id];
      crewMap[c.id] = {
        name: c.name,
        current_lat: freshLoc?.lat ?? c.current_lat,
        current_lng: freshLoc?.lng ?? c.current_lng,
      };
    });
    return crewMap;
  })();
}

export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ deliveries: [], moves: [] });

  const admin = createAdminClient();
  const todayStr = getTodayString();

  const deliveryStatuses = ["confirmed", "accepted", "approved", "dispatched", "in-transit", "in_transit", "in_progress"];
  const moveStatuses = ["confirmed", "scheduled", "in_progress"];

  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    admin
      .from("deliveries")
      .select(
        "id, delivery_number, customer_name, status, delivery_address, pickup_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, crew_id",
      )
      .in("organization_id", orgIds)
      .eq("scheduled_date", todayStr)
      .in("status", deliveryStatuses)
      .order("scheduled_date", { ascending: true }),
    admin
      .from("moves")
      .select(
        "id, move_code, client_name, status, scheduled_date, from_address, to_address, from_lat, from_lng, to_lat, to_lng, crew_id",
      )
      .in("organization_id", orgIds)
      .eq("scheduled_date", todayStr)
      .in("status", moveStatuses),
  ]);

  const dRows = deliveries ?? [];
  const mRows = moves ?? [];

  const crewIdSet = new Set<string>();
  dRows.forEach((d) => {
    if (d.crew_id) crewIdSet.add(d.crew_id);
  });
  mRows.forEach((m) => {
    if (m.crew_id) crewIdSet.add(m.crew_id);
  });
  const crewIds = [...crewIdSet];

  const crewMap = await buildCrewMap(crewIds);

  const deliveryIds = dRows.map((d) => d.id);
  const moveIds = mRows.map((m) => m.id);

  const deliverySessionMap: Record<string, { live_stage: string | null }> = {};
  if (deliveryIds.length > 0) {
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("job_id, status, is_active")
      .in("job_id", deliveryIds)
      .eq("job_type", "delivery")
      .eq("is_active", true);

    (sessions || []).forEach((s) => {
      deliverySessionMap[s.job_id] = { live_stage: s.status };
    });
  }

  const moveSessionMap: Record<string, { live_stage: string | null }> = {};
  if (moveIds.length > 0) {
    const { data: moveSessions } = await admin
      .from("tracking_sessions")
      .select("job_id, status, is_active")
      .in("job_id", moveIds)
      .eq("job_type", "move")
      .eq("is_active", true);

    (moveSessions || []).forEach((s) => {
      moveSessionMap[s.job_id] = { live_stage: s.status };
    });
  }

  const deliveryCoords = await Promise.all(
    dRows.map(async (d) => {
      const pickup =
        d.pickup_lat != null && d.pickup_lng != null
          ? { lat: Number(d.pickup_lat), lng: Number(d.pickup_lng) }
          : (d.pickup_address ? await geocodeAddress(d.pickup_address) : null);
      const dropoff =
        d.delivery_lat != null && d.delivery_lng != null
          ? { lat: Number(d.delivery_lat), lng: Number(d.delivery_lng) }
          : (d.delivery_address ? await geocodeAddress(d.delivery_address) : null);
      return { pickup, dropoff };
    }),
  );

  const moveCoords = await Promise.all(
    mRows.map(async (m) => {
      const from =
        m.from_lat != null && m.from_lng != null
          ? { lat: Number(m.from_lat), lng: Number(m.from_lng) }
          : (m.from_address ? await geocodeAddress(m.from_address) : null);
      const to =
        m.to_lat != null && m.to_lng != null
          ? { lat: Number(m.to_lat), lng: Number(m.to_lng) }
          : (m.to_address ? await geocodeAddress(m.to_address) : null);
      return { from, to };
    }),
  );

  const enrichedDeliveries = dRows.map((d, i) => {
    const crew = d.crew_id ? crewMap[d.crew_id] : null;
    const session = deliverySessionMap[d.id];
    const isJobActive = session != null;
    const liveStage = session?.live_stage || "";
    const headingToPickup = PICKUP_STAGES.includes(liveStage) || !liveStage.trim();
    const { pickup: pickupCoords, dropoff: dropoffCoords } = deliveryCoords[i]!;
    const destCoords = headingToPickup ? (pickupCoords ?? dropoffCoords) : (dropoffCoords ?? pickupCoords);

    return {
      job_kind: "delivery" as const,
      id: d.id,
      delivery_number: d.delivery_number,
      customer_name: d.customer_name,
      status: d.status,
      delivery_address: d.delivery_address,
      crew_id: d.crew_id,
      crew_name: crew?.name || null,
      crew_lat: isJobActive ? (crew?.current_lat || null) : null,
      crew_lng: isJobActive ? (crew?.current_lng || null) : null,
      dest_lat: destCoords?.lat ?? null,
      dest_lng: destCoords?.lng ?? null,
      live_stage: session?.live_stage || null,
      is_job_active: isJobActive,
    };
  });

  const enrichedMoves = mRows.map((m, i) => {
    const crew = m.crew_id ? crewMap[m.crew_id] : null;
    const session = moveSessionMap[m.id];
    const isJobActive = session != null;
    const liveStage = session?.live_stage || "";
    const headingToPickup = PICKUP_STAGES.includes(liveStage) || !liveStage.trim();
    const { from: fromCoords, to: toCoords } = moveCoords[i]!;
    const destCoords = headingToPickup ? (fromCoords ?? toCoords) : (toCoords ?? fromCoords);

    return {
      job_kind: "move" as const,
      id: m.id,
      delivery_number: m.move_code,
      customer_name: m.client_name,
      status: m.status,
      delivery_address: m.to_address || m.from_address,
      crew_id: m.crew_id,
      crew_name: crew?.name || null,
      crew_lat: isJobActive ? (crew?.current_lat || null) : null,
      crew_lng: isJobActive ? (crew?.current_lng || null) : null,
      dest_lat: destCoords?.lat ?? null,
      dest_lng: destCoords?.lng ?? null,
      live_stage: session?.live_stage || null,
      is_job_active: isJobActive,
    };
  });

  enrichedDeliveries.sort((a, b) => {
    const aActive = a.is_job_active ? 1 : 0;
    const bActive = b.is_job_active ? 1 : 0;
    return bActive - aActive;
  });
  enrichedMoves.sort((a, b) => {
    const aActive = a.is_job_active ? 1 : 0;
    const bActive = b.is_job_active ? 1 : 0;
    return bActive - aActive;
  });

  return NextResponse.json({ deliveries: enrichedDeliveries, moves: enrichedMoves });
}
