import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getPlatformToggles } from "@/lib/platform-settings";

const RATE_LIMIT_MS = 2000;
const rateLimit = new Map<string, number>();
const GEOFENCE_RADIUS_M = 100;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GEOFENCE_TRANSITIONS: Record<
  string,
  { nearField: "pickup" | "delivery"; newSessionStatus: string }
> = {
  en_route_to_pickup: { nearField: "pickup", newSessionStatus: "arrived_at_pickup" },
  en_route_to_destination: { nearField: "delivery", newSessionStatus: "arrived_at_destination" },
};

function mapSessionStatus(status: string | null, isActive: boolean): string {
  if (!isActive || !status) return "idle";
  const map: Record<string, string> = {
    en_route_to_pickup: "en_route_pickup",
    arrived_at_pickup: "at_pickup",
    loading: "loading",
    en_route_to_destination: "en_route_delivery",
    arrived_at_destination: "at_delivery",
    unloading: "unloading",
    completed: "idle",
    not_started: "idle",
  };
  return map[status] || "idle";
}

export async function POST(req: NextRequest) {
  const toggles = await getPlatformToggles();
  if (!toggles.crew_tracking) {
    return NextResponse.json({ error: "Crew GPS tracking is disabled" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId, lat, lng, accuracy, speed, heading, timestamp } = body;
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "lat, lng required" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const ts = timestamp || new Date().toISOString();
  const lastLocation = { lat: latNum, lng: lngNum, accuracy: Number(accuracy) || 0, timestamp: ts };

  const admin = createAdminClient();

  // ── Rate limiting ──
  const rateLimitKey = sessionId || `team:${payload.teamId}`;
  const now = Date.now();
  const last = rateLimit.get(rateLimitKey) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    await admin
      .from("crews")
      .update({ current_lat: latNum, current_lng: lngNum, updated_at: ts })
      .eq("id", payload.teamId);
    return NextResponse.json({ ok: true, throttled: true });
  }
  rateLimit.set(rateLimitKey, now);

  // Fetch crew name once for use in crew_locations
  const { data: crewRow } = await admin
    .from("crews")
    .select("name")
    .eq("id", payload.teamId)
    .single();
  const crewName = crewRow?.name || null;

  // ── Idle path (no active session) ──
  if (!sessionId) {
    await Promise.all([
      admin
        .from("crews")
        .update({ current_lat: latNum, current_lng: lngNum, updated_at: ts })
        .eq("id", payload.teamId),
      admin.from("crew_locations").upsert(
        {
          crew_id: payload.teamId,
          crew_name: crewName,
          lat: latNum,
          lng: lngNum,
          heading: heading != null ? Number(heading) : null,
          speed: speed != null ? Number(speed) : null,
          accuracy: accuracy != null ? Number(accuracy) : null,
          status: "idle",
          current_move_id: null,
          current_client_name: null,
          current_from_address: null,
          current_to_address: null,
          updated_at: ts,
        },
        { onConflict: "crew_id" },
      ),
    ]);

    void admin.from("crew_location_history").insert({
      crew_id: payload.teamId,
      lat: latNum,
      lng: lngNum,
      heading: heading != null ? Number(heading) : null,
      speed: speed != null ? Number(speed) : null,
    });

    return NextResponse.json({ ok: true });
  }

  // ── Session-based tracking ──
  const { data: session } = await admin
    .from("tracking_sessions")
    .select("id, team_id, job_id, job_type, is_active, status, last_location, updated_at, checkpoints")
    .eq("id", sessionId)
    .single();

  if (!session || session.team_id !== payload.teamId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Idle detection (no movement for 10+ min)
  const prevLoc = session.last_location as { lat?: number; lng?: number } | null;
  const prevUpdatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0;
  const samePosition =
    prevLoc &&
    typeof prevLoc.lat === "number" &&
    typeof prevLoc.lng === "number" &&
    Math.abs(prevLoc.lat - latNum) < 0.0002 &&
    Math.abs(prevLoc.lng - lngNum) < 0.0002;
  const idleMins = (Date.now() - prevUpdatedAt) / 60000;

  if (session.is_active && samePosition && idleMins >= 10) {
    const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
    const lastCp = checkpoints[checkpoints.length - 1] as { status?: string } | undefined;
    if (lastCp?.status !== "idle") {
      checkpoints.push({
        status: "idle",
        timestamp: new Date().toISOString(),
        lat: latNum,
        lng: lngNum,
        note: `No movement ${Math.round(idleMins)}+ min`,
      });
      await admin
        .from("tracking_sessions")
        .update({ checkpoints, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
  }

  // ── Determine status + geofencing ──
  let sessionStatus = session.status as string;
  let autoAdvanced = false;

  // Move context (only for move jobs)
  let moveId: string | null = null;
  let moveClientName: string | null = null;
  let moveFrom: string | null = null;
  let moveTo: string | null = null;

  if (session.is_active && session.job_type === "move" && session.job_id) {
    const { data: move } = await admin
      .from("moves")
      .select("id, client_name, from_address, to_address, from_lat, from_lng, to_lat, to_lng")
      .eq("id", session.job_id as string)
      .single();

    if (move) {
      moveId = move.id;
      moveClientName = move.client_name;
      moveFrom = move.from_address;
      moveTo = move.to_address;

      // Geofencing: auto-detect arrival at pickup or delivery
      const transition = sessionStatus ? GEOFENCE_TRANSITIONS[sessionStatus] : undefined;
      if (transition) {
        let targetLat: number | null = null;
        let targetLng: number | null = null;

        if (transition.nearField === "pickup" && move.from_lat && move.from_lng) {
          targetLat = Number(move.from_lat);
          targetLng = Number(move.from_lng);
        } else if (transition.nearField === "delivery" && move.to_lat && move.to_lng) {
          targetLat = Number(move.to_lat);
          targetLng = Number(move.to_lng);
        }

        if (targetLat != null && targetLng != null) {
          const distM = haversineM(latNum, lngNum, targetLat, targetLng);
          if (distM < GEOFENCE_RADIUS_M) {
            sessionStatus = transition.newSessionStatus;
            autoAdvanced = true;

            const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
            checkpoints.push({
              status: transition.newSessionStatus,
              timestamp: ts,
              lat: latNum,
              lng: lngNum,
              note: `Auto-detected arrival (${Math.round(distM)}m from location)`,
            });

            await admin
              .from("tracking_sessions")
              .update({
                status: transition.newSessionStatus,
                checkpoints,
                last_location: lastLocation,
                updated_at: ts,
              })
              .eq("id", sessionId);
          }
        }
      }
    }
  }

  // ── Single crew_locations upsert (no race condition) ──
  const crewLocStatus = mapSessionStatus(sessionStatus, session.is_active);

  await admin.from("crew_locations").upsert(
    {
      crew_id: session.team_id,
      crew_name: crewName,
      lat: latNum,
      lng: lngNum,
      heading: heading != null ? Number(heading) : null,
      speed: speed != null ? Number(speed) : null,
      accuracy: Number(accuracy) || null,
      status: crewLocStatus,
      current_move_id: moveId,
      current_client_name: moveClientName,
      current_from_address: moveFrom,
      current_to_address: moveTo,
      updated_at: ts,
    },
    { onConflict: "crew_id" },
  );

  // History
  void admin.from("crew_location_history").insert({
    crew_id: session.team_id,
    move_id: moveId,
    lat: latNum,
    lng: lngNum,
    heading: heading != null ? Number(heading) : null,
    speed: speed != null ? Number(speed) : null,
  });

  // Update crew position
  await admin
    .from("crews")
    .update({
      current_lat: latNum,
      current_lng: lngNum,
      updated_at: ts,
      status:
        session.is_active && sessionStatus && !["completed", "not_started"].includes(sessionStatus)
          ? "en-route"
          : "standby",
    })
    .eq("id", session.team_id);

  if (!session.is_active) {
    return NextResponse.json({ ok: true, autoAdvanced });
  }

  // Update session location + insert location_updates
  await admin.from("location_updates").insert({
    session_id: sessionId,
    lat: latNum,
    lng: lngNum,
    accuracy: lastLocation.accuracy,
    speed: speed != null ? Number(speed) : null,
    heading: heading != null ? Number(heading) : null,
    timestamp: ts,
  });

  if (!autoAdvanced) {
    await admin
      .from("tracking_sessions")
      .update({ last_location: lastLocation, updated_at: ts })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, autoAdvanced, status: sessionStatus });
}
