import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import {
  formatLastPositionLine,
  reverseGeocodePlaceName,
} from "@/lib/mapbox/reverse-geocode";

const STALE_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();

  const { data: sessions, error } = await admin
    .from("tracking_sessions")
    .select("id, job_id, team_id, updated_at, job_type")
    .eq("is_active", true)
    .eq("job_type", "move");

  if (error) {
    console.error("gps-health cron:", error);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  let alerted = 0;

  for (const s of sessions || []) {
    if (!s.updated_at) continue;
    if (now - new Date(s.updated_at).getTime() < STALE_MS) continue;

    const { data: move } = await admin
      .from("moves")
      .select("id, move_code, gps_alert_sent, status")
      .eq("id", s.job_id)
      .maybeSingle();

    if (!move) continue;
    const st = (move.status || "").toLowerCase();
    if (["completed", "cancelled"].includes(st)) continue;
    if (move.gps_alert_sent) continue;

    const minutesAgo = (now - new Date(s.updated_at).getTime()) / 60000;

    const { data: loc } = await admin
      .from("crew_locations")
      .select("lat, lng")
      .eq("crew_id", s.team_id)
      .maybeSingle();

    const lastLat = loc?.lat != null ? Number(loc.lat) : null;
    const lastLng = loc?.lng != null ? Number(loc.lng) : null;
    let pos = "unknown";
    if (lastLat != null && lastLng != null) {
      const address = await reverseGeocodePlaceName(lastLat, lastLng);
      pos = formatLastPositionLine(lastLat, lastLng, address);
    }

    const code = move.move_code || String(move.id).slice(0, 8);

    await notifyAdmins("crew_gps_offline", {
      subject: `Crew GPS offline: ${code}`,
      body: `Crew GPS offline for ${Math.round(minutesAgo)} minutes. Last position: ${pos}.`,
      moveId: move.id,
      description: `Move ${code}: GPS stale ${Math.round(minutesAgo)} min`,
    });

    await admin.from("moves").update({ gps_alert_sent: true }).eq("id", move.id);
    alerted += 1;
  }

  return NextResponse.json({ ok: true, checked: (sessions || []).length, alerted });
}
