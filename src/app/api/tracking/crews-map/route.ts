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
  ] = await Promise.all([
    admin.from("crews").select("id, name, members, current_lat, current_lng, status, updated_at, delay_minutes").order("name"),
    admin.from("tracking_sessions").select("id, team_id, job_id, job_type, status, last_location, updated_at").eq("is_active", true),
    admin.from("crew_members").select("id, name, team_id").eq("is_active", true),
    admin.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address").order("scheduled_date"),
    admin.from("moves").select("id, move_code, crew_id, stage"),
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

  const crewsOut = (crews || []).map((c) => {
    const session = sessionByTeam.get(c.id);
    const loc = session?.last_location as { lat?: number; lng?: number } | null;
    const hasSessionPos = loc?.lat != null && loc?.lng != null;
    const hasCrewPos = c.current_lat != null && c.current_lng != null;
    const lat = hasCrewPos ? c.current_lat : hasSessionPos ? loc!.lat! : null;
    const lng = hasCrewPos ? c.current_lng : hasSessionPos ? loc!.lng! : null;

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

    return {
      id: c.id,
      name: c.name,
      members,
      status: effectiveStatus,
      current_lat: lat,
      current_lng: lng,
      current_job: currentJob,
      updated_at: c.updated_at || session?.updated_at,
      delay_minutes: c.delay_minutes,
    };
  });

  const activeSessions = (sessions || []).map((s) => {
    const job = s.job_type === "move"
      ? (moves || []).find((m) => m.id === s.job_id)
      : (deliveries || []).find((d) => d.id === s.job_id);
    const jobId = job ? (s.job_type === "move" ? (job as any).move_code : (job as any).delivery_number) : s.job_id;
    const crew = crews?.find((c) => c.id === s.team_id);
    const loc = s.last_location as { lat?: number; lng?: number } | null;
    return {
      id: s.id,
      jobId,
      jobType: s.job_type,
      status: s.status,
      teamName: crew?.name || "Crew",
      teamId: s.team_id,
      lastLocation: loc,
      updatedAt: s.updated_at,
      detailHref: s.job_type === "move" ? `/admin/moves/${jobId}` : `/admin/deliveries/${jobId}`,
    };
  });

  return NextResponse.json(
    { crews: crewsOut, activeSessions },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
