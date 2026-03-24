import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { getTodayString } from "@/lib/business-timezone";
import {
  fetchMoveDayWeatherBrief,
  fetchMoveDayWeatherBriefForAddress,
} from "@/lib/weather/openweather-move-brief";
import { buildPrecipAlertText, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

type HqWeatherPayload = {
  brief: MoveWeatherBrief | null;
  alert: string | null;
  label: string;
};

/**
 * GET — today’s forecast for the same service area as the crew portal
 * (`CREW_PORTAL_WEATHER_*` + `OPENWEATHER_API_KEY`). Admin only.
 */
export async function GET() {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const rl = rateLimit(`admin-hq-weather:${user!.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  const addr = process.env.CREW_PORTAL_WEATHER_ADDRESS?.trim();
  const label =
    process.env.CREW_PORTAL_WEATHER_LABEL?.trim() ||
    (addr ? "Service area" : "Local forecast");
  const postal = process.env.CREW_PORTAL_WEATHER_POSTAL?.trim() || "M5H2N2";

  if (!apiKey) {
    const empty: HqWeatherPayload = { brief: null, alert: null, label };
    return NextResponse.json(empty);
  }

  const today = getTodayString();
  let brief: MoveWeatherBrief | null = null;
  if (addr && addr.length >= 4) {
    brief = await fetchMoveDayWeatherBriefForAddress(addr, today, apiKey);
  }
  if (!brief) {
    brief = await fetchMoveDayWeatherBrief(postal, today, apiKey);
  }

  const payload: HqWeatherPayload = {
    brief,
    alert: brief ? buildPrecipAlertText(brief) : null,
    label,
  };
  return NextResponse.json(payload);
}
