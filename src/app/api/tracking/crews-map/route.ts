import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getPlatformToggles } from "@/lib/platform-settings";

/** GET all crews with live positions for unified tracking map. Staff only; requires crew tracking enabled. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const toggles = await getPlatformToggles();
  if (!toggles.crew_tracking) {
    return NextResponse.json({ crews: [], activeSessions: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const admin = createAdminClient();

  const [
    { data: crews },
    { data: sessions },
    { data: crewMembers },
    { data: deliveries },
    { data: moves },
    { data: locations },
  ] = await Promise.all([
    admin.from("crews").select("id, name, members, current_lat, current_lng, status, updated_at, delay_minutes").order("name"),
    admin.from("tracking_sessions").select("id, team_id, job_id, job_type, status, last_location, updated_at").eq("is_active", true),
    admin.from("crew_members").select("id, name, team_id").eq("is_active", true),
    admin.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address").order("scheduled_date"),
    admin.from("moves").select("id, move_code, crew_id, stage"),
    admin.from("crew_locations").select("crew_id, lat, lng, status, updated_at, current_move_id, current_client_name, current_from_address, current_to_address"),
  ]);

  type SessionRow = NonNullable<typeof sessions>[number];
  const sessionByTeam = new Map<string, SessionRow>();
  for (const s of sessions || []) {
    const existing = sessionByTeam.get(s.team_id);
    if (!existing || (s.updated_at || "") > (existing.updated_at || "")) {
      sessionByTeam.set(s.team_id, s);
    }
  }

  const membersByTeam = new Map<string, string[]>();
  for (const m of crewMembers || []) {
    const list = membersByTeam.get(m.team_id) || [];
    list.push(m.name);
    membersByTeam.set(m.team_id, list);
  }

  type DeliveryRow = NonNullable<typeof deliveries>[number];
  const deliveryByCrew = new Map<string, DeliveryRow[]>();
  for (const d of deliveries || []) {
    if (d.crew_id) {
      const list = deliveryByCrew.get(d.crew_id) || [];
      list.push(d);
      deliveryByCrew.set(d.crew_id, list);
    }
  }

  type MoveRow = NonNullable<typeof moves>[number];
  const moveByCrew = new Map<string, MoveRow[]>();
  for (const m of moves || []) {
    if (m.crew_id) {
      const list = moveByCrew.get(m.crew_id) || [];
      list.push(m);
      moveByCrew.set(m.crew_id, list);
    }
  }

  const locationByCrew = new Map<string, { lat: number; lng: number; status?: string; updated_at?: string }>();
  for (const loc of locations || []) {
    if (loc.crew_id && loc.lat != null && loc.lng != null) {
      locationByCrew.set(loc.crew_id, {
        lat: Number(loc.lat),
        lng: Number(loc.lng),
        status: loc.status ?? undefined,
        updated_at: loc.updated_at ?? undefined,
      });
    }
  }

  const crewsOut = (crews || []).map((c) => {
    const session = sessionByTeam.get(c.id);
    const sessionLoc = session?.last_location as { lat?: number; lng?: number } | null;
    const hasSessionPos = sessionLoc?.lat != null && sessionLoc?.lng != null;
    const hasCrewPos = c.current_lat != null && c.current_lng != null;
    const locRow = locationByCrew.get(c.id);
    const hasLocPos = locRow?.lat != null && locRow?.lng != null;
    // Full-time tracking: show crew on map whenever we have a position — session (preferred) > crew row > crew_locations.
    const lat = hasSessionPos ? sessionLoc!.lat! : (hasCrewPos ? c.current_lat! : (hasLocPos ? locRow!.lat : null));
    const lng = hasSessionPos ? sessionLoc!.lng! : (hasCrewPos ? c.current_lng! : (hasLocPos ? locRow!.lng : null));

    const pendingDeliveries = (deliveryByCrew.get(c.id) || []).filter((d) => !["delivered", "cancelled"].includes(d.status || ""));
    const pendingMoves = (moveByCrew.get(c.id) || []).filter((m) => !["completed", "cancelled"].includes(m.stage || ""));
    const currentDelivery = pendingDeliveries[0];
    const currentMove = pendingMoves[0];
    const currentJob = currentDelivery?.delivery_number || currentMove?.move_code || null;

    const effectiveStatus =
      c.status === "en-route" ? "en-route" :
      session && !["completed", "not_started"].includes(session.status || "") ? "en-route" :
      "standby";

    const members = (c.members as string[] | null) || membersByTeam.get(c.id) || [];
    const displayName = (c.name && c.name.trim()) || members[0] || `Team ${(c.id || "").slice(0, 8)}`;

    return {
      id: c.id,
      name: displayName,
      members,
      status: effectiveStatus,
      current_lat: lat,
      current_lng: lng,
      current_job: currentJob,
      updated_at: c.updated_at || session?.updated_at,
      delay_minutes: c.delay_minutes,
    };
  });

  const inactiveStatuses = ["completed", "delivered", "done", "not_started", "cancelled"];
  const STALE_MS = 90 * 60 * 1000; // 90 minutes — sessions not updated in this window are stale
  const now = Date.now();

  // Auto-close stale sessions in the database so they don't keep appearing
  const staleIds = (sessions || [])
    .filter((s) => {
      if (!s.updated_at) return true;
      const status = (s.status || "").toLowerCase();
      return inactiveStatuses.includes(status) || now - new Date(s.updated_at).getTime() > STALE_MS;
    })
    .map((s) => s.id);
  if (staleIds.length > 0) {
    admin.from("tracking_sessions").update({ is_active: false }).in("id", staleIds).then(() => {});
  }

  const activeSessions = (sessions || [])
    .filter((s) => {
      const status = (s.status || "").toLowerCase();
      if (inactiveStatuses.includes(status)) return false;
      if (!s.updated_at || now - new Date(s.updated_at).getTime() > STALE_MS) return false;
      return true;
    })
    .map((s) => {
      const job = s.job_type === "move"
        ? (moves || []).find((m) => m.id === s.job_id)
        : (deliveries || []).find((d) => d.id === s.job_id);
      if (!job) return null;
      const jobId = s.job_type === "move" ? (job as any).move_code || s.job_id : (job as any).delivery_number || s.job_id;
      const jobName = s.job_type === "move" ? (job as any).client_name : ((job as any).customer_name || (job as any).client_name || "Delivery");
      const crew = crews?.find((c) => c.id === s.team_id);
      const members = membersByTeam.get(s.team_id) || [];
      const teamName = (crew?.name && crew.name.trim()) || members[0] || `Team ${(s.team_id || "").slice(0, 8)}`;
      const loc = s.last_location as { lat?: number; lng?: number } | null;
      const toAddress = s.job_type === "move" ? null : (job as any).delivery_address;
      return {
        id: s.id,
        jobId,
        job_type: s.job_type,
        jobType: s.job_type,
        status: s.status,
        teamName,
        team_id: s.team_id,
        teamId: s.team_id,
        lastLocation: loc,
        updatedAt: s.updated_at,
        detailHref: s.job_type === "move" ? `/admin/moves/${jobId}` : `/admin/deliveries/${jobId}`,
        jobName,
        toAddress,
      };
    })
    .filter(Boolean);

  return NextResponse.json(
    { crews: crewsOut, activeSessions },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
