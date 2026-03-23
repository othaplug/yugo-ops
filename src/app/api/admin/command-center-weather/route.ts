import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { fetchMoveDayWeatherBriefForAddress } from "@/lib/weather/openweather-move-brief";
import { buildPrecipAlertText, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

type WeatherResult = { brief: MoveWeatherBrief; alert: string | null };

/**
 * POST { moves: { id, fromAddress, date }[] }
 * Returns weather briefs for up to 8 moves. Admin only.
 */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const rl = rateLimit(`admin-cc-weather:${user!.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ weather: {} as Record<string, WeatherResult> });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawMoves = (body as { moves?: unknown })?.moves;
  if (!Array.isArray(rawMoves)) {
    return NextResponse.json({ error: "moves array required" }, { status: 400 });
  }

  type MoveInput = { id: string; fromAddress: string; date: string };
  const moves: MoveInput[] = rawMoves
    .filter(
      (x): x is MoveInput =>
        x != null &&
        typeof (x as MoveInput).id === "string" &&
        typeof (x as MoveInput).fromAddress === "string" &&
        (x as MoveInput).fromAddress.length >= 4 &&
        typeof (x as MoveInput).date === "string" &&
        (x as MoveInput).date.length >= 8,
    )
    .slice(0, 8);

  const weather: Record<string, WeatherResult> = {};
  const cache = new Map<string, MoveWeatherBrief | null>();

  for (const m of moves) {
    const ck = `${m.fromAddress.toLowerCase()}|${m.date}`;
    if (!cache.has(ck)) {
      const brief = await fetchMoveDayWeatherBriefForAddress(m.fromAddress, m.date, apiKey);
      cache.set(ck, brief);
    }
    const brief = cache.get(ck);
    if (brief) {
      weather[m.id] = { brief, alert: buildPrecipAlertText(brief) };
    }
  }

  return NextResponse.json({ weather });
}
