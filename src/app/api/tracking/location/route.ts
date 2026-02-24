import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getPlatformToggles } from "@/lib/platform-settings";

const RATE_LIMIT_MS = 2000; // 2 sec min between location updates per session
const rateLimit = new Map<string, number>();

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
  const lastLocation = {
    lat: latNum,
    lng: lngNum,
    accuracy: Number(accuracy) || 0,
    timestamp: ts,
  };

  const admin = createAdminClient();

  // Full-time tracking: sessionId is optional. When provided, update session + crew; when omitted, update only crew so position is always visible on tracking page.
  const rateLimitKey = sessionId || `team:${payload.teamId}`;
  const now = Date.now();
  const last = rateLimit.get(rateLimitKey) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    if (!sessionId) {
      await admin.from("crews").update({
        current_lat: lastLocation.lat,
        current_lng: lastLocation.lng,
        updated_at: ts,
      }).eq("id", payload.teamId);
    }
    return NextResponse.json({ ok: true, throttled: true });
  }
  rateLimit.set(rateLimitKey, now);

  if (!sessionId) {
    await admin.from("crews").update({
      current_lat: lastLocation.lat,
      current_lng: lastLocation.lng,
      updated_at: ts,
    }).eq("id", payload.teamId);
    return NextResponse.json({ ok: true });
  }

  const { data: session } = await admin
    .from("tracking_sessions")
    .select("id, team_id, is_active, status, last_location, updated_at, checkpoints")
    .eq("id", sessionId)
    .single();

  if (!session || session.team_id !== payload.teamId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const lastLoc = session.last_location as { lat?: number; lng?: number } | null;
  const updatedAt = session.updated_at ? new Date(session.updated_at).getTime() : 0;
  const samePosition = lastLoc && typeof lastLoc.lat === "number" && typeof lastLoc.lng === "number" &&
    Math.abs(lastLoc.lat - latNum) < 0.0002 && Math.abs(lastLoc.lng - lngNum) < 0.0002;
  const idleMins = (Date.now() - updatedAt) / 60000;
  if (session.is_active && samePosition && idleMins >= 10) {
    const checkpoints = Array.isArray(session.checkpoints) ? [...session.checkpoints] : [];
    const lastCp = checkpoints[checkpoints.length - 1] as { status?: string } | undefined;
    if (lastCp?.status !== "idle") {
      checkpoints.push({ status: "idle", timestamp: new Date().toISOString(), lat: latNum, lng: lngNum, note: `No movement ${Math.round(idleMins)}+ min` });
      await admin.from("tracking_sessions").update({ checkpoints, updated_at: new Date().toISOString() }).eq("id", sessionId);
    }
  }

  // Always update crew position (vehicle/asset security) so admin map shows current truck location even after job completion
  await admin.from("crews").update({
    current_lat: lastLocation.lat,
    current_lng: lastLocation.lng,
    updated_at: ts,
    status: session.is_active && session.status && !["completed", "not_started"].includes(session.status) ? "en-route" : "standby",
  }).eq("id", session.team_id);

  if (!session.is_active) return NextResponse.json({ ok: true });

  await Promise.all([
    admin.from("location_updates").insert({
      session_id: sessionId,
      lat: lastLocation.lat,
      lng: lastLocation.lng,
      accuracy: lastLocation.accuracy,
      speed: speed != null ? Number(speed) : null,
      heading: heading != null ? Number(heading) : null,
      timestamp: ts,
    }),
    admin.from("tracking_sessions").update({
      last_location: lastLocation,
      updated_at: ts,
    }).eq("id", sessionId),
  ]);

  return NextResponse.json({ ok: true });
}
