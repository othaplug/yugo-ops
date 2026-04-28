import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getPlatformToggles } from "@/lib/platform-settings";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import type { SupabaseClient } from "@supabase/supabase-js";

const RATE_LIMIT_MS = 2000;
const RATE_LIMIT_MS_NAVIGATION = 1000;
const rateLimit = new Map<string, number>();
const GEOFENCE_RADIUS_M = 100;

/** Navigation: long stop during en-route without GPS speed implying movement */
const NAV_STOP_MS = 5 * 60 * 1000;
const NAV_STATIONARY_RADIUS_M = 25;
const navStationaryState = new Map<string, { anchorLat: number; anchorLng: number; sinceMs: number }>();

const EN_ROUTE_FOR_NAV_STOP = new Set([
  "en_route_to_pickup",
  "en_route_to_destination",
  "en_route",
  "on_route",
  "in_transit",
]);

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
  // Primary statuses (moves + deliveries)
  en_route_to_pickup: { nearField: "pickup", newSessionStatus: "arrived_at_pickup" },
  en_route_to_destination: { nearField: "delivery", newSessionStatus: "arrived_at_destination" },
  // Legacy/variant statuses (moves)
  on_route: { nearField: "pickup", newSessionStatus: "arrived_on_site" },
  en_route: { nearField: "pickup", newSessionStatus: "arrived" },
  in_transit: { nearField: "delivery", newSessionStatus: "arrived_at_destination" },
};

const OFF_JOB_IDLE_MIN = 12;
const OFF_JOB_MIN_DIST_M = 165;

async function jobAnchorPointsLatLng(
  admin: SupabaseClient,
  jobType: string,
  jobId: string
): Promise<{ lat: number; lng: number }[]> {
  const out: { lat: number; lng: number }[] = [];
  if (jobType === "move") {
    const { data: m } = await admin
      .from("moves")
      .select("from_lat, from_lng, to_lat, to_lng")
      .eq("id", jobId)
      .single();
    if (m?.from_lat != null && m?.from_lng != null)
      out.push({ lat: Number(m.from_lat), lng: Number(m.from_lng) });
    if (m?.to_lat != null && m?.to_lng != null) out.push({ lat: Number(m.to_lat), lng: Number(m.to_lng) });
  } else if (jobType === "delivery") {
    const { data: d } = await admin
      .from("deliveries")
      .select("pickup_lat, pickup_lng, delivery_lat, delivery_lng")
      .eq("id", jobId)
      .single();
    if (d?.pickup_lat != null && d?.pickup_lng != null)
      out.push({ lat: Number(d.pickup_lat), lng: Number(d.pickup_lng) });
    if (d?.delivery_lat != null && d?.delivery_lng != null)
      out.push({ lat: Number(d.delivery_lat), lng: Number(d.delivery_lng) });
    const { data: stops } = await admin.from("delivery_stops").select("lat, lng").eq("delivery_id", jobId);
    for (const st of stops || []) {
      if (st.lat != null && st.lng != null) out.push({ lat: Number(st.lat), lng: Number(st.lng) });
    }
  }
  return out;
}

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
    // Delivery short statuses — must map here or crew_locations shows "idle" while session is active
    en_route: "en_route_pickup",
    arrived: "at_pickup",
    delivering: "at_delivery",
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
  const {
    sessionId,
    lat,
    lng,
    accuracy,
    speed,
    heading,
    timestamp,
    source,
    eta_seconds,
    distance_remaining_meters,
    is_navigating,
    approx_address,
  } = body;
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "lat, lng required" }, { status: 400 });
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const ts = timestamp || new Date().toISOString();
  const lastLocation = { lat: latNum, lng: lngNum, accuracy: Number(accuracy) || 0, timestamp: ts };
  const sourceStr = typeof source === "string" ? source : "";
  const isNavigationSource = sourceStr === "navigation";
  const etaSeconds =
    eta_seconds != null && !Number.isNaN(Number(eta_seconds)) ? Math.round(Number(eta_seconds)) : null;
  const distRemainM =
    distance_remaining_meters != null && !Number.isNaN(Number(distance_remaining_meters))
      ? Math.round(Number(distance_remaining_meters))
      : null;
  const navActive = Boolean(is_navigating) || isNavigationSource;
  const approxAddr =
    typeof approx_address === "string" && approx_address.trim() ? approx_address.trim().slice(0, 200) : null;

  const admin = createAdminClient();

  // ── Rate limiting (navigation posts may be slightly more frequent) ──
  const rateLimitKey = sessionId || `team:${payload.teamId}`;
  const limitMs = isNavigationSource ? RATE_LIMIT_MS_NAVIGATION : RATE_LIMIT_MS;
  const now = Date.now();
  const last = rateLimit.get(rateLimitKey) ?? 0;
  if (now - last < limitMs) {
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
          nav_eta_seconds: null,
          nav_distance_remaining_m: null,
          is_navigating: false,
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

  if (
    session.is_active &&
    samePosition &&
    idleMins >= OFF_JOB_IDLE_MIN &&
    session.job_id &&
    (session.job_type === "move" || session.job_type === "delivery")
  ) {
    const anchors = await jobAnchorPointsLatLng(admin, session.job_type as string, session.job_id as string);
    if (anchors.length > 0) {
      const minD = Math.min(...anchors.map((a) => haversineM(latNum, lngNum, a.lat, a.lng)));
      if (minD > OFF_JOB_MIN_DIST_M) {
        const { data: snap } = await admin.from("tracking_sessions").select("checkpoints").eq("id", sessionId).single();
        const cp = Array.isArray(snap?.checkpoints) ? [...snap.checkpoints] : [];
        const dup = cp
          .slice(-10)
          .some(
            (x: { note?: string }) =>
              typeof (x as { note?: string }).note === "string" &&
              (x as { note: string }).note.includes("Away from scheduled job stops")
          );
        if (!dup) {
          cp.push({
            status: sessionStatus,
            timestamp: new Date().toISOString(),
            lat: latNum,
            lng: lngNum,
            note: `Idle away from scheduled job stops (~${Math.round(minD)} m from nearest stop)`,
          });
          await admin
            .from("tracking_sessions")
            .update({ checkpoints: cp, updated_at: new Date().toISOString() })
            .eq("id", sessionId);
          void notifyAdmins("crew_idle_off_route", {
            description: `Crew stationary ${Math.round(idleMins)}+ min, roughly ${Math.round(minD)} m from pickup, drop-off, and listed stops. Confirm on live map.`,
            moveId: session.job_type === "move" ? String(session.job_id) : undefined,
            deliveryId: session.job_type === "delivery" ? String(session.job_id) : undefined,
          });
        }
      }
    }
  }

  // Move context (only for move jobs)
  let moveId: string | null = null;
  let moveClientName: string | null = null;
  let moveFrom: string | null = null;
  let moveTo: string | null = null;

  if (session.is_active && session.job_type === "move" && session.job_id) {
    const { data: move } = await admin
      .from("moves")
      .select("id, client_name, from_address, to_address, from_lat, from_lng, to_lat, to_lng, status")
      .eq("id", session.job_id as string)
      .single();

    if (move) {
      moveId = move.id;
      moveClientName = move.client_name;
      moveFrom = move.from_address;
      moveTo = move.to_address;

      await admin.from("moves").update({ gps_alert_sent: false }).eq("id", move.id);

      const moveTerminal = ["completed", "cancelled", "delivered", "job_complete"].includes(
        String((move as { status?: string }).status || "").toLowerCase(),
      );

      // Geofencing: auto-detect arrival at pickup or delivery (never advance a finished move)
      const transition =
        !moveTerminal && sessionStatus ? GEOFENCE_TRANSITIONS[sessionStatus] : undefined;
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

  // Delivery geofencing: auto-detect arrival at pickup or delivery (same as moves)
  if (session.is_active && session.job_type === "delivery" && session.job_id && !autoAdvanced) {
    const { data: delivery } = await admin
      .from("deliveries")
      .select("id, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
      .eq("id", session.job_id as string)
      .single();

    if (delivery) {
      const transition = sessionStatus ? GEOFENCE_TRANSITIONS[sessionStatus] : undefined;
      if (transition) {
        let targetLat: number | null = null;
        let targetLng: number | null = null;

        if (transition.nearField === "pickup" && delivery.pickup_lat != null && delivery.pickup_lng != null) {
          targetLat = Number(delivery.pickup_lat);
          targetLng = Number(delivery.pickup_lng);
        } else if (transition.nearField === "delivery" && delivery.delivery_lat != null && delivery.delivery_lng != null) {
          targetLat = Number(delivery.delivery_lat);
          targetLng = Number(delivery.delivery_lng);
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

  // ── Navigation: long stationary stop during en-route (5+ min, ~25m radius, slow/null speed) ──
  if (
    !autoAdvanced &&
    isNavigationSource &&
    session.is_active &&
    EN_ROUTE_FOR_NAV_STOP.has(sessionStatus)
  ) {
    const sp = speed != null ? Number(speed) : NaN;
    const slow = Number.isNaN(sp) || sp < 1;
    const fast = !slow;
    let st = navStationaryState.get(sessionId);

    if (fast) {
      navStationaryState.delete(sessionId);
    } else {
      const movedFar =
        st != null && haversineM(latNum, lngNum, st.anchorLat, st.anchorLng) > NAV_STATIONARY_RADIUS_M;
      if (movedFar || !st) {
        navStationaryState.set(sessionId, { anchorLat: latNum, anchorLng: lngNum, sinceMs: now });
      } else if (slow && now - st.sinceMs >= NAV_STOP_MS) {
        const mins = Math.round((now - st.sinceMs) / 60000);
        const place = approxAddr ? ` at ${approxAddr}` : "";
        const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
        const lastNote = (checkpoints[checkpoints.length - 1] as { note?: string } | undefined)?.note;
        const dup = lastNote?.includes("Stopped during navigation");
        if (!dup) {
          checkpoints.push({
            status: sessionStatus,
            timestamp: new Date().toISOString(),
            lat: latNum,
            lng: lngNum,
            note: `Stopped during navigation for ${mins} min${place}`,
          });
          await admin
            .from("tracking_sessions")
            .update({ checkpoints, updated_at: new Date().toISOString() })
            .eq("id", sessionId);
        }
        navStationaryState.set(sessionId, { anchorLat: latNum, anchorLng: lngNum, sinceMs: now });
      }
    }
  } else if (!isNavigationSource) {
    navStationaryState.delete(sessionId);
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
      nav_eta_seconds: navActive ? etaSeconds : null,
      nav_distance_remaining_m: navActive ? distRemainM : null,
      is_navigating: navActive,
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
    source: sourceStr || null,
    eta_seconds: etaSeconds,
    distance_remaining_meters: distRemainM,
    is_navigating: navActive,
  });

  if (!autoAdvanced) {
    await admin
      .from("tracking_sessions")
      .update({ last_location: lastLocation, updated_at: ts })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, autoAdvanced, status: sessionStatus });
}
