/**
 * OpenWeather → move-day brief or current-weather snapshot.
 *
 * Resolution order for coordinates:
 *   1. Canadian postal found in address → OWM zip geocoding
 *   2. Otherwise → Mapbox geocoding to get lat/lng
 *
 * Weather source:
 *   • Move within 5 days → 5-day/3h forecast → daytime aggregate
 *   • Move beyond 5 days or today → OWM "current weather" as live snapshot
 */

import {
  analyzeDaytimeForecast,
  buildRoadConditionsNote,
  type MoveWeatherBrief,
  type OwmForecastListItem,
} from "@/lib/weather/move-weather-brief";
import { geocode as mapboxGeocode } from "@/lib/mapbox/driving-distance";

export const MOVE_WEATHER_TZ = "America/Toronto";
const DAYTIME_START_HOUR = 6;
const DAYTIME_END_HOUR = 18;

/** Canadian postal code from free-text address (A1A1A1 or A1A 1A1). */
export function extractCanadianPostal(address: string): string | null {
  const match = address.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
  return match ? match[0].toUpperCase().replace(/\s/, "") : null;
}

function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

function precipFromId(id: number): { rain: boolean; snow: boolean } {
  if (!Number.isFinite(id)) return { rain: false, snow: false };
  if (id >= 200 && id <= 531) return { rain: true, snow: false };
  if (id >= 600 && id <= 622) return { rain: false, snow: true };
  return { rain: false, snow: false };
}

/** Resolve address → lat/lng via postal or Mapbox */
async function resolveCoords(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lon: number } | null> {
  const postal = extractCanadianPostal(address);
  if (postal) {
    try {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(postal)},CA&appid=${apiKey}`,
      );
      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (typeof geo.lat === "number" && typeof geo.lon === "number") {
          return { lat: geo.lat, lon: geo.lon };
        }
      }
    } catch { /* fall through to Mapbox */ }
  }
  const coords = await mapboxGeocode(address);
  if (!coords) return null;
  return { lat: coords.lat, lon: coords.lng };
}

/** OWM current weather → MoveWeatherBrief snapshot */
async function fetchCurrentWeatherBrief(
  lat: number,
  lon: number,
  dateLabel: string,
  apiKey: string,
): Promise<MoveWeatherBrief | null> {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
    );
    if (!res.ok) return null;
    const d = await res.json();

    const temp = d.main?.temp ?? 0;
    const feelsLike = d.main?.feels_like ?? null;
    const tempMin = d.main?.temp_min ?? temp;
    const tempMax = d.main?.temp_max ?? temp;
    const humidity = d.main?.humidity ?? null;
    const windSpeed = typeof d.wind?.speed === "number" ? d.wind.speed : null;
    const windGust = typeof d.wind?.gust === "number" ? d.wind.gust : null;
    const visibility = typeof d.visibility === "number" ? d.visibility : null;
    const wId = Number(d.weather?.[0]?.id);
    const desc = d.weather?.[0]?.description || "current conditions";
    const { rain, snow } = precipFromId(wId);
    const heavyRain = wId >= 502 && wId <= 504;
    const freezingRisk = temp <= 0 || (snow && temp <= 2);

    const windMaxKmh = windSpeed != null ? msToKmh(windSpeed) : null;
    const windGustMaxKmh = windGust != null ? msToKmh(windGust) : null;

    return {
      date: dateLabel,
      tempHighC: Math.round(tempMax),
      tempLowC: Math.round(tempMin),
      tempAvgC: Math.round(temp * 10) / 10,
      feelsLikeAvgC: feelsLike != null ? Math.round(feelsLike * 10) / 10 : null,
      windMaxKmh,
      windGustMaxKmh,
      visibilityMinM: visibility,
      humidityAvg: humidity,
      precipProbabilityMax: rain || snow ? 0.7 : null,
      conditionsSummary: desc,
      rainDay: rain,
      snowDay: snow,
      roadConditionsNote: buildRoadConditionsNote({
        rainDay: rain,
        snowDay: snow,
        visibilityMinM: visibility,
        windGustMaxKmh,
        windMaxKmh,
        heavyRain,
        freezingRisk,
      }),
    };
  } catch {
    return null;
  }
}

/** Days between today and a YYYY-MM-DD date */
function daysUntil(dateYmd: string): number {
  const now = new Date();
  const target = new Date(dateYmd + "T12:00:00");
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Fetch weather brief for an address + scheduled date.
 * Within 5-day window → forecast aggregate. Beyond → current weather snapshot.
 */
export async function fetchMoveDayWeatherBriefForAddress(
  address: string,
  scheduledDateYmd: string,
  apiKey: string,
): Promise<MoveWeatherBrief | null> {
  const addr = address?.trim();
  if (!addr || addr.length < 4 || !scheduledDateYmd) return null;
  try {
    const coords = await resolveCoords(addr, apiKey);
    if (!coords) return null;

    const days = daysUntil(scheduledDateYmd);

    if (days >= 0 && days <= 4) {
      const forecastRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${coords.lat}&lon=${coords.lon}&appid=${apiKey}&units=metric`,
      );
      if (forecastRes.ok) {
        const forecast = (await forecastRes.json()) as { list?: OwmForecastListItem[] };
        const brief = analyzeDaytimeForecast({
          list: forecast.list || [],
          targetDate: scheduledDateYmd,
          timeZone: MOVE_WEATHER_TZ,
          daytimeStartHour: DAYTIME_START_HOUR,
          daytimeEndHour: DAYTIME_END_HOUR,
        });
        if (brief) return brief;
      }
    }

    // Beyond forecast window or forecast returned nothing → current weather
    return fetchCurrentWeatherBrief(coords.lat, coords.lon, scheduledDateYmd, apiKey);
  } catch {
    return null;
  }
}

/** Legacy: postal-only path used by the daily cron. */
export async function fetchMoveDayWeatherBrief(
  postal: string,
  scheduledDateYmd: string,
  apiKey: string,
): Promise<MoveWeatherBrief | null> {
  const pc = postal?.trim().toUpperCase().replace(/\s/g, "");
  if (!pc || !scheduledDateYmd) return null;
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/zip?zip=${encodeURIComponent(pc)},CA&appid=${apiKey}`,
    );
    if (!geoRes.ok) return null;
    const geo = await geoRes.json();
    const { lat, lon } = geo;
    if (typeof lat !== "number" || typeof lon !== "number") return null;

    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
    );
    if (!forecastRes.ok) return null;
    const forecast = (await forecastRes.json()) as { list?: OwmForecastListItem[] };
    return analyzeDaytimeForecast({
      list: forecast.list || [],
      targetDate: scheduledDateYmd,
      timeZone: MOVE_WEATHER_TZ,
      daytimeStartHour: DAYTIME_START_HOUR,
      daytimeEndHour: DAYTIME_END_HOUR,
    });
  } catch {
    return null;
  }
}
