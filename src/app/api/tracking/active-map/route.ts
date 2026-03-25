import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFuelConfigMap, resolveNavigationFuelPriceCadPerLitre, NAV_FUEL_KEYS } from "@/lib/routing/fuel-config";
import { normalizeCrewTruckType } from "@/lib/routing/truck-profile";

function routeDestinationForSession(
  status: string,
  jobType: string,
  job: Record<string, unknown> | undefined
): { lat: number; lng: number } | null {
  if (!job) return null;
  const enPickup = ["en_route_to_pickup", "en_route", "on_route"].includes(status);
  const enDest = ["en_route_to_destination", "in_transit"].includes(status);
  if (jobType === "move") {
    const m = job as { from_lat?: unknown; from_lng?: unknown; to_lat?: unknown; to_lng?: unknown };
    if (enPickup && m.from_lat != null && m.from_lng != null) {
      return { lat: Number(m.from_lat), lng: Number(m.from_lng) };
    }
    if (enDest && m.to_lat != null && m.to_lng != null) {
      return { lat: Number(m.to_lat), lng: Number(m.to_lng) };
    }
  } else {
    const d = job as {
      pickup_lat?: unknown;
      pickup_lng?: unknown;
      delivery_lat?: unknown;
      delivery_lng?: unknown;
    };
    if (enPickup && d.pickup_lat != null && d.pickup_lng != null) {
      return { lat: Number(d.pickup_lat), lng: Number(d.pickup_lng) };
    }
    if (enDest && d.delivery_lat != null && d.delivery_lng != null) {
      return { lat: Number(d.delivery_lat), lng: Number(d.delivery_lng) };
    }
  }
  return null;
}

/** GET active sessions with full job + crew details for map. Staff only. */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user.id).single();
  if (!platformUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const { data: fuelCfgRows } = await admin.from("platform_config").select("key, value").in("key", [...NAV_FUEL_KEYS]);
  const fuelPriceCadPerLitre = resolveNavigationFuelPriceCadPerLitre(buildFuelConfigMap(fuelCfgRows));

  const { data: sessions } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, status, last_location, updated_at, team_id, crew_lead_id")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (!sessions?.length) {
    return NextResponse.json({ sessions: [], markers: [], fuelPriceCadPerLitre });
  }

  const teamIds = [...new Set(sessions.map((s) => s.team_id))];
  const { data: crews } = await admin.from("crews").select("id, name").in("id", teamIds);
  const teamMap = new Map((crews || []).map((c) => [c.id, c.name]));

  const { data: crewLocs } = await admin
    .from("crew_locations")
    .select("crew_id, is_navigating, nav_eta_seconds, nav_distance_remaining_m")
    .in("crew_id", teamIds);
  const navByCrew = new Map((crewLocs || []).map((c) => [c.crew_id, c]));

  const moveIds = sessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = sessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const { data: moves } = moveIds.length
    ? await admin
        .from("moves")
        .select("id, client_name, move_code, to_address, from_address, to_lat, to_lng, from_lat, from_lng, truck_primary")
        .in("id", moveIds)
    : { data: [] };
  const { data: deliveries } = deliveryIds.length
    ? await admin
        .from("deliveries")
        .select(
          "id, customer_name, client_name, delivery_number, delivery_address, pickup_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng, vehicle_type"
        )
        .in("id", deliveryIds)
    : { data: [] };

  const moveMap = new Map((moves || []).map((m) => [m.id, m]));
  const deliveryMap = new Map((deliveries || []).map((d) => [d.id, d]));

  const markers: { id: string; lat: number; lng: number; name: string; jobName: string; jobId: string; status: string; updatedAt: string }[] = [];

  for (const s of sessions) {
    const job = s.job_type === "move" ? moveMap.get(s.job_id) : deliveryMap.get(s.job_id);
    const jobName = job
      ? (s.job_type === "move" ? (job as any).client_name : `${(job as any).customer_name} (${(job as any).client_name})`)
      : "-";
    const jobId = job
      ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number)
      : s.job_id;
    const teamName = teamMap.get(s.team_id) || "Crew";
    const loc = s.last_location as { lat?: number; lng?: number } | null;
    if (loc?.lat != null && loc?.lng != null) {
      markers.push({
        id: s.id,
        lat: loc.lat,
        lng: loc.lng,
        name: teamName,
        jobName,
        jobId,
        status: s.status,
        updatedAt: s.updated_at || "",
      });
    }
  }

  const sessionsWithDetails = sessions.map((s) => {
    const job = s.job_type === "move" ? moveMap.get(s.job_id) : deliveryMap.get(s.job_id);
    const jobName = job
      ? (s.job_type === "move" ? (job as any).client_name : `${(job as any).customer_name} (${(job as any).client_name})`)
      : "-";
    const jobId = job
      ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number)
      : s.job_id;
    const toAddress = job ? (s.job_type === "move" ? (job as any).to_address : (job as any).delivery_address) : null;
    const loc = s.last_location as { lat?: number; lng?: number } | null;
    const nav = navByCrew.get(s.team_id);
    const routeDestination = routeDestinationForSession(s.status, s.job_type, job as Record<string, unknown> | undefined);
    const truckTypeRaw =
      s.job_type === "move"
        ? ((job as { truck_primary?: string | null } | undefined)?.truck_primary ?? null)
        : ((job as { vehicle_type?: string | null } | undefined)?.vehicle_type ?? null);
    return {
      id: s.id,
      jobId,
      jobType: s.job_type,
      jobName,
      status: s.status,
      teamName: teamMap.get(s.team_id) || "-",
      lastLocation: loc,
      updatedAt: s.updated_at,
      toAddress,
      detailHref: s.job_type === "move" ? `/admin/moves/${jobId}` : `/admin/deliveries/${jobId}`,
      routeDestination,
      truckType: normalizeCrewTruckType(truckTypeRaw),
      isNavigating: Boolean(nav?.is_navigating),
      navEtaSeconds: nav?.nav_eta_seconds != null ? Number(nav.nav_eta_seconds) : null,
      navDistanceRemainingM: nav?.nav_distance_remaining_m != null ? Number(nav.nav_distance_remaining_m) : null,
    };
  });

  return NextResponse.json({ sessions: sessionsWithDetails, markers, fuelPriceCadPerLitre });
}
