import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getTodayString } from "@/lib/business-timezone";
import { rateLimit } from "@/lib/rate-limit";
import { fetchMoveDayWeatherBriefForAddress } from "@/lib/weather/openweather-move-brief";
import { buildPrecipAlertText, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

type WeatherResult = { brief: MoveWeatherBrief; alert: string | null };

/**
 * GET — today's weather briefs for the crew team's jobs.
 * Crew cookie auth. Rate-limited.
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`crew-weather:${payload.teamId}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ weather: {} as Record<string, WeatherResult> });
  }

  const today = getTodayString();
  const supabase = createAdminClient();

  const [movesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select("id, from_address, scheduled_date")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today),
    supabase
      .from("deliveries")
      .select("id, pickup_address, scheduled_date")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today),
  ]);

  type Row = { id: string; address: string; date: string };
  const rows: Row[] = [];

  for (const m of movesRes.data || []) {
    const addr = String(m.from_address || "").trim();
    if (addr.length >= 4) rows.push({ id: m.id, address: addr, date: String(m.scheduled_date || "") });
  }
  for (const d of deliveriesRes.data || []) {
    const addr = String(d.pickup_address || "").trim();
    if (addr.length >= 4) rows.push({ id: d.id, address: addr, date: String(d.scheduled_date || "") });
  }

  const weather: Record<string, WeatherResult> = {};
  const cache = new Map<string, MoveWeatherBrief | null>();
  const MAX = 6;

  for (const row of rows.slice(0, MAX)) {
    const ck = `${row.address.toLowerCase()}|${row.date}`;
    if (!cache.has(ck)) {
      const brief = await fetchMoveDayWeatherBriefForAddress(row.address, row.date, apiKey);
      cache.set(ck, brief);
    }
    const brief = cache.get(ck);
    if (brief) {
      weather[row.id] = { brief, alert: buildPrecipAlertText(brief) };
    }
  }

  return NextResponse.json({ weather });
}
