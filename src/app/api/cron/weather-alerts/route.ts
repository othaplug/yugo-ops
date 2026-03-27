import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { buildPrecipAlertText } from "@/lib/weather/move-weather-brief";
import {
  extractCanadianPostal,
  fetchMoveDayWeatherBrief,
  MOVE_WEATHER_TZ,
} from "@/lib/weather/openweather-move-brief";

/**
 * Vercel Cron: runs daily at 6 AM EST.
 * Fetches OpenWeather daytime forecast per move date → `moves.weather_brief` (always when postal resolves).
 * Sets `weather_alert` + SMS only when rain/snow in that window.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, skipped: "OPENWEATHER_API_KEY not configured" });
  }

  const supabase = createAdminClient();

  const cfg = await getFeatureConfig(["weather_alerts_enabled"]);
  if (cfg.weather_alerts_enabled === "false") {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const startStr = formatLocalYmd(Date.now(), MOVE_WEATHER_TZ);
  const endStr = addDaysYmd(startStr, 2);

  const { data: moves } = await supabase
    .from("moves")
    .select("id, move_code, client_name, client_email, client_phone, scheduled_date, from_address")
    .in("status", [
      "confirmed",
      "scheduled",
      "paid",
      "in_progress",
      "confirmed_pending_schedule",
      "confirmed_unassigned",
    ])
    .gte("scheduled_date", startStr)
    .lte("scheduled_date", endStr);

  const results = { checked: 0, briefSet: 0, alertSet: 0, notified: 0, errors: [] as string[] };

  for (const move of moves ?? []) {
    try {
      results.checked++;
      const postal = extractCanadianPostal(move.from_address || "");
      if (!postal) continue;

      const brief = await fetchMoveDayWeatherBrief(postal, move.scheduled_date, apiKey);
      const checkedAt = new Date().toISOString();
      if (!brief) {
        await supabase
          .from("moves")
          .update({ weather_brief: null, weather_alert: null, weather_checked_at: checkedAt })
          .eq("id", move.id);
        continue;
      }

      const alertText = buildPrecipAlertText(brief);
      await supabase
        .from("moves")
        .update({
          weather_brief: brief,
          weather_checked_at: checkedAt,
          weather_alert: alertText,
        })
        .eq("id", move.id);
      results.briefSet++;
      if (alertText) results.alertSet++;

      if (alertText && move.client_phone) {
        const firstName = (move.client_name || "").split(" ")[0] || "there";
        const moveDateLabel = new Date(move.scheduled_date + "T12:00:00").toLocaleDateString("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
        });
        const msg = buildClientSMS(firstName, alertText, moveDateLabel);
        await sendSMS(move.client_phone, msg).catch(() => {});
        results.notified++;
      }
    } catch (err) {
      results.errors.push(`${move.move_code}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

function formatLocalYmd(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return "";
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const [ys, ms, ds] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(ys, ms - 1, ds + days));
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const d = dt.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function buildClientSMS(firstName: string, alertText: string, dateLabel: string): string {
  if (alertText.includes("Snow")) {
    return [
      `Hi ${firstName},`,
      `Snow is forecast for your move on ${dateLabel}.`,
      `Don't worry — we've prepared additional protection for your belongings, including tarps and waterproof covers.`,
      `We've got you covered.`,
    ].join("\n\n");
  }
  return [
    `Hi ${firstName},`,
    `Rain is forecast for your move on ${dateLabel}.`,
    `Don't worry — we've prepared additional protection for your belongings, including tarps and waterproof covers.`,
    `See you then!`,
  ].join("\n\n");
}
