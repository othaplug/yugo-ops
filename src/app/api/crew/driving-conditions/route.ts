import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getTodayString } from "@/lib/business-timezone";
import { getDrivingTrafficBrief, type DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import { rateLimit } from "@/lib/rate-limit";

function routablePair(from: string, to: string): boolean {
  const f = from?.trim();
  const t = to?.trim();
  if (!f || !t) return false;
  if (f === "—" || t === "—") return false;
  if (f.length < 4 || t.length < 4) return false;
  return true;
}

/**
 * Today's jobs for the crew team: Mapbox driving-traffic briefs (duration vs baseline, congestion, closures).
 * GET — crew cookie only. Rate-limited; results keyed by job row `id`.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`crew-traffic:${payload.teamId}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const today = getTodayString();
  const supabase = createAdminClient();

  const [movesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select("id, from_address, to_address")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today),
    supabase
      .from("deliveries")
      .select("id, pickup_address, delivery_address")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today),
  ]);

  type Row = { id: string; from: string; to: string };
  const rows: Row[] = [];

  for (const m of movesRes.data || []) {
    const from = String(m.from_address || "");
    const to = String(m.to_address || "");
    if (routablePair(from, to)) rows.push({ id: m.id, from, to });
  }
  for (const d of deliveriesRes.data || []) {
    const from = String(d.pickup_address || "");
    const to = String(d.delivery_address || "");
    if (routablePair(from, to)) rows.push({ id: d.id, from, to });
  }

  const max = 6;
  const slice = rows.slice(0, max);
  const traffic: Record<string, DrivingTrafficBrief> = {};

  for (const row of slice) {
    try {
      const brief = await getDrivingTrafficBrief(row.from, row.to);
      if (brief) traffic[row.id] = brief;
    } catch {
      /* skip */
    }
  }

  return NextResponse.json({ traffic });
}
