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
  if (!sessionId || lat == null || lng == null) {
    return NextResponse.json({ error: "sessionId, lat, lng required" }, { status: 400 });
  }

  const now = Date.now();
  const last = rateLimit.get(sessionId) ?? 0;
  if (now - last < RATE_LIMIT_MS) {
    return NextResponse.json({ ok: true, throttled: true });
  }
  rateLimit.set(sessionId, now);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("tracking_sessions")
    .select("id, team_id, is_active, status")
    .eq("id", sessionId)
    .single();

  if (!session || session.team_id !== payload.teamId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (!session.is_active) return NextResponse.json({ ok: true });

  const ts = timestamp || new Date().toISOString();
  const lastLocation = {
    lat: Number(lat),
    lng: Number(lng),
    accuracy: Number(accuracy) || 0,
    timestamp: ts,
  };

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
    admin.from("crews").update({
      current_lat: lastLocation.lat,
      current_lng: lastLocation.lng,
      updated_at: ts,
      status: session.status && !["completed", "not_started"].includes(session.status) ? "en-route" : "standby",
    }).eq("id", session.team_id),
  ]);

  return NextResponse.json({ ok: true });
}
