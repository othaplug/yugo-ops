import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import {
  isDeliveryRowLiveForMap,
  isMoveRowLiveForMap,
  sessionStatusAllowsJobCode,
} from "@/lib/tracking-live-job-display";
/** Fallback position when a live session has no GPS yet — so "LIVE" panel and "teams on map" stay in sync. */
const FALLBACK_LAT = 43.66027;
const FALLBACK_LNG = -79.35365;

const STALE_MS = 12 * 60 * 60 * 1000;
const PANEL_EXCLUDE_STATUSES = ["not_started", "cancelled", "idle"];

function isSessionActiveForPanel(s: { status?: string | null; updated_at?: string | null }): boolean {
  const status = (s.status || "").toLowerCase();
  if (PANEL_EXCLUDE_STATUSES.includes(status)) return false;
  if (!s.updated_at || Date.now() - new Date(s.updated_at).getTime() > STALE_MS) return false;
  return true;
}

/**
 * Show a job code only when tracking was explicitly started and the job is still in progress
 * (not stale assignment / completed work / idle short-status mismatch).
 */
function jobCodeFromStartedSession(
  session: { job_id: string; job_type: string; status?: string | null; started_at?: string | null } | undefined,
  deliveries: { id: string; delivery_number?: string | null; status?: string | null }[],
  moves: { id: string; move_code?: string | null; status?: string | null }[],
): string | null {
  if (!session) return null;
  if (!session.started_at) return null;
  if (!sessionStatusAllowsJobCode(session.status)) return null;
  if (session.job_type === "move") {
    const m = moves.find((row) => row.id === session.job_id);
    if (!m) return null;
    const ms = (m.status || "").toLowerCase();
    if (["completed", "cancelled"].includes(ms)) return null;
    if (!isMoveRowLiveForMap(m.status)) return null;
    return m.move_code ?? null;
  }
  const d = deliveries.find((row) => row.id === session.job_id);
  if (!d) return null;
  const ds = (d.status || "").toLowerCase();
  if (["delivered", "completed", "cancelled"].includes(ds)) return null;
  if (!isDeliveryRowLiveForMap(d.status)) return null;
  return d.delivery_number ?? null;
}

/** GET all crews with live positions for unified tracking map. Staff only. */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

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
    admin.from("tracking_sessions").select("id, team_id, job_id, job_type, status, last_location, updated_at, started_at").eq("is_active", true),
    admin.from("crew_members").select("id, name, team_id").eq("is_active", true),
    admin.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address"),
    admin.from("moves").select("id, move_code, crew_id, stage, status"),
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
    let lat = hasSessionPos ? sessionLoc!.lat! : (hasCrewPos ? c.current_lat! : (hasLocPos ? locRow!.lat : null));
    let lng = hasSessionPos ? sessionLoc!.lng! : (hasCrewPos ? c.current_lng! : (hasLocPos ? locRow!.lng : null));
    // If still no position but this crew has an active session (shown in LIVE panel), use fallback so they appear on the map.
    if ((lat == null || lng == null) && session && isSessionActiveForPanel(session)) {
      lat = lat ?? FALLBACK_LAT;
      lng = lng ?? FALLBACK_LNG;
    }

    const currentJob = jobCodeFromStartedSession(session, deliveries || [], moves || []);

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

  // Synthesize virtual crew entries for active sessions whose team has no row in the crews table.
  // This happens when a crew member is tracked via crew_members but the team was never added to
  // the crews table — the session exists, GPS is live, but crewsOut would otherwise be empty.
  // We include sessions of ANY status (even completed) as long as last_location is present, so
  // teams always remain visible on the map throughout and after the job.
  const crewIdsInTable = new Set((crews || []).map((c) => c.id));
  for (const [teamId, session] of sessionByTeam.entries()) {
    if (crewIdsInTable.has(teamId)) continue; // already represented by a real crews row
    const loc = session.last_location as { lat?: number; lng?: number } | null;
    let lat = loc?.lat ?? null;
    let lng = loc?.lng ?? null;
    // If no GPS yet but session is active (shown in LIVE panel), use fallback so team appears on map.
    if ((lat == null || lng == null) && isSessionActiveForPanel(session)) {
      lat = lat ?? FALLBACK_LAT;
      lng = lng ?? FALLBACK_LNG;
    }
    if (lat == null || lng == null) continue; // no position and not active, skip
    const members = membersByTeam.get(teamId) || [];
    const displayName = members[0] || `Team ${teamId.slice(0, 8)}`;
    const currentJob = jobCodeFromStartedSession(session, deliveries || [], moves || []);
    const sessionStatus = (session.status || "").toLowerCase();
    const doneStatuses = ["completed", "delivered", "done", "not_started", "cancelled"];
    crewsOut.push({
      id: teamId,
      name: displayName,
      members,
      status: doneStatuses.includes(sessionStatus) ? "standby" : "en-route",
      current_lat: lat,
      current_lng: lng,
      current_job: currentJob,
      updated_at: session.updated_at ?? undefined,
      delay_minutes: undefined,
    });
  }

  // Only auto-close sessions that haven't had ANY update in 12 hours (true inactivity, not job completion).
  const now = Date.now();
  const staleIds = (sessions || [])
    .filter((s) => {
      if (!s.updated_at) return true;
      return now - new Date(s.updated_at).getTime() > STALE_MS;
    })
    .map((s) => s.id);
  if (staleIds.length > 0) {
    admin.from("tracking_sessions").update({ is_active: false }).in("id", staleIds).then(() => {});
  }

  // Active sessions for the panel — show all non-abandoned sessions updated within 12 hours.
  const activeSessions = (sessions || [])
    .filter((s) => isSessionActiveForPanel(s))
    .map((s) => {
      if (!sessionStatusAllowsJobCode(s.status)) return null;
      const job = s.job_type === "move"
        ? (moves || []).find((m) => m.id === s.job_id)
        : (deliveries || []).find((d) => d.id === s.job_id);
      if (!job) return null;
      if (s.job_type === "move") {
        if (!isMoveRowLiveForMap((job as { status?: string | null }).status)) return null;
      } else {
        if (!isDeliveryRowLiveForMap((job as { status?: string | null }).status)) return null;
      }
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
