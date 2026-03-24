/**
 * Shared types + aggregation for move-day weather (OpenWeather 5-day / 3-hour forecast).
 * Used by `/api/cron/weather-alerts` and typed in admin + crew UIs.
 */

export type MoveWeatherBrief = {
  date: string;
  /** °C — daytime window (move-day local) */
  tempHighC: number;
  tempLowC: number;
  tempAvgC: number;
  feelsLikeAvgC: number | null;
  /** km/h */
  windMaxKmh: number | null;
  windGustMaxKmh: number | null;
  /** meters; lower = worse for driving */
  visibilityMinM: number | null;
  humidityAvg: number | null;
  /** 0–1 max POP in window */
  precipProbabilityMax: number | null;
  conditionsSummary: string;
  rainDay: boolean;
  snowDay: boolean;
  /** Human-readable driving / loading guidance (not a live traffic API) */
  roadConditionsNote: string;
};

export type OwmForecastListItem = {
  dt: number;
  weather?: { id?: number; main?: string; description?: string }[];
  main?: {
    temp?: number;
    feels_like?: number;
    temp_min?: number;
    temp_max?: number;
    humidity?: number;
  };
  wind?: { speed?: number; deg?: number; gust?: number };
  visibility?: number;
  pop?: number;
};

/** OpenWeather condition codes: rain / drizzle / thunderstorm / snow */
export function precipFromOpenWeatherId(id: number): { rain: boolean; snow: boolean } {
  if (!Number.isFinite(id)) return { rain: false, snow: false };
  if (id >= 200 && id <= 232) return { rain: true, snow: false };
  if (id >= 300 && id <= 321) return { rain: true, snow: false };
  if (id >= 500 && id <= 531) return { rain: true, snow: false };
  if (id >= 600 && id <= 622) {
    if (id === 611 || id === 612 || id === 613 || id === 615 || id === 616) return { rain: true, snow: true };
    return { rain: false, snow: true };
  }
  return { rain: false, snow: false };
}

function msToKmh(ms: number): number {
  return Math.round(ms * 3.6);
}

/**
 * Derive road / travel guidance from aggregated fields (weather-based only — not live traffic).
 */
export function buildRoadConditionsNote(b: {
  rainDay: boolean;
  snowDay: boolean;
  visibilityMinM: number | null;
  windGustMaxKmh: number | null;
  windMaxKmh: number | null;
  heavyRain: boolean;
  freezingRisk: boolean;
}): string {
  const parts: string[] = [];

  if (b.freezingRisk) {
    parts.push("Icy or freezing conditions possible, drive slowly and secure cargo against slips.");
  }
  if (b.snowDay) {
    parts.push("Snow in the forecast, allow extra travel time between stops; check vehicle readiness.");
  }
  if (b.heavyRain || (b.rainDay && b.visibilityMinM != null && b.visibilityMinM < 8000)) {
    parts.push("Wet roads and reduced grip, increase following distance and corner gently.");
  } else if (b.rainDay) {
    parts.push("Rain possible, plan for covered loading when possible.");
  }

  if (b.visibilityMinM != null && b.visibilityMinM < 5000) {
    parts.push("Low visibility, use headlights and extra caution on highways.");
  }

  if (b.windGustMaxKmh != null && b.windGustMaxKmh >= 50) {
    parts.push("Strong gusts, secure doors, hand trucks, and loose items when outdoors.");
  } else if (b.windMaxKmh != null && b.windMaxKmh >= 40) {
    parts.push("Breezy conditions, watch for wind when carrying tall or light items.");
  }

  if (parts.length === 0) {
    return "Conditions look typical for local driving. Still allow buffer time between jobs.";
  }

  return parts.join(" ");
}

/**
 * Aggregate 3-hour slots into one daytime brief for `targetDate` (YYYY-MM-DD) in `timeZone`.
 */
export function analyzeDaytimeForecast(params: {
  list: OwmForecastListItem[];
  targetDate: string;
  timeZone: string;
  daytimeStartHour: number;
  daytimeEndHour: number;
}): MoveWeatherBrief | null {
  const { list, targetDate, timeZone, daytimeStartHour, daytimeEndHour } = params;

  const relevant = list.filter((item) => {
    const ms = item.dt * 1000;
    const ymd = formatLocalYmd(ms, timeZone);
    const hour = localHour(ms, timeZone);
    return ymd === targetDate && hour >= daytimeStartHour && hour <= daytimeEndHour;
  });

  if (relevant.length === 0) return null;

  let rainDay = false;
  let snowDay = false;
  let heavyRain = false;
  let freezingRisk = false;
  const descriptions: string[] = [];
  const temps: number[] = [];
  const feels: number[] = [];
  const lows: number[] = [];
  const highs: number[] = [];
  const winds: number[] = [];
  const gusts: number[] = [];
  const visibilities: number[] = [];
  const humidities: number[] = [];
  const pops: number[] = [];

  for (const item of relevant) {
    const w = item.weather?.[0];
    const id = Number(w?.id);
    const { rain: idRain, snow: idSnow } = precipFromOpenWeatherId(id);
    const main = (w?.main || "").toLowerCase();
    const mainRain = main === "rain" || main === "drizzle" || main === "thunderstorm";
    const mainSnow = main === "snow";
    if (idRain || mainRain) rainDay = true;
    if (idSnow || mainSnow) snowDay = true;
    if (id >= 502 || id === 503 || id === 504) heavyRain = true;
    if (id >= 511 || id === 611 || id === 612) freezingRisk = true;
    const desc = w?.description || "";
    if (desc) descriptions.push(desc);

    const m = item.main;
    if (typeof m?.temp === "number") temps.push(m.temp);
    if (typeof m?.feels_like === "number") feels.push(m.feels_like);
    if (typeof m?.temp_min === "number") lows.push(m.temp_min);
    if (typeof m?.temp_max === "number") highs.push(m.temp_max);
    if (typeof item.wind?.speed === "number") winds.push(item.wind.speed);
    if (typeof item.wind?.gust === "number") gusts.push(item.wind.gust);
    if (typeof item.visibility === "number" && item.visibility > 0) visibilities.push(item.visibility);
    if (typeof m?.humidity === "number") humidities.push(m.humidity);
    if (typeof item.pop === "number") pops.push(item.pop);
  }

  const tempAvgC =
    temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : 0;
  const tempLowC = lows.length ? Math.round(Math.min(...lows)) : temps.length ? Math.round(Math.min(...temps)) : tempAvgC;
  const tempHighC = highs.length ? Math.round(Math.max(...highs)) : temps.length ? Math.round(Math.max(...temps)) : tempAvgC;

  const feelsLikeAvgC =
    feels.length > 0 ? Math.round((feels.reduce((a, b) => a + b, 0) / feels.length) * 10) / 10 : null;

  const windMaxKmh = winds.length ? msToKmh(Math.max(...winds)) : null;
  const windGustMaxKmh = gusts.length ? msToKmh(Math.max(...gusts)) : null;
  const visibilityMinM = visibilities.length ? Math.min(...visibilities) : null;
  const humidityAvg =
    humidities.length > 0 ? Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length) : null;
  const precipProbabilityMax = pops.length > 0 ? Math.round(Math.max(...pops) * 100) / 100 : null;

  const conditionsSummary =
    descriptions[0] ||
    (snowDay ? "Snow in forecast" : rainDay ? "Rain in forecast" : "Mostly fair");

  const roadConditionsNote = buildRoadConditionsNote({
    rainDay,
    snowDay,
    visibilityMinM,
    windGustMaxKmh,
    windMaxKmh,
    heavyRain,
    freezingRisk,
  });

  return {
    date: targetDate,
    tempHighC,
    tempLowC,
    tempAvgC,
    feelsLikeAvgC,
    windMaxKmh,
    windGustMaxKmh,
    visibilityMinM,
    humidityAvg,
    precipProbabilityMax,
    conditionsSummary,
    rainDay,
    snowDay,
    roadConditionsNote,
  };
}

export function formatLocalYmd(ms: number, timeZone: string): string {
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

function localHour(ms: number, timeZone: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(new Date(ms));
  return parseInt(h, 10);
}

/** SMS / Command Center alert line — only when precip warrants ops attention */
export function buildPrecipAlertText(brief: MoveWeatherBrief): string | null {
  if (brief.snowDay) {
    return `Snow forecast (${brief.conditionsSummary}). High ${brief.tempHighC}°C / low ${brief.tempLowC}°C. Extra tarps and waterproof covers loaded.`;
  }
  if (brief.rainDay) {
    return `Rain forecast (${brief.conditionsSummary}). High ${brief.tempHighC}°C / low ${brief.tempLowC}°C. Extra tarps and waterproof covers loaded.`;
  }
  return null;
}

export function isMoveWeatherBrief(v: unknown): v is MoveWeatherBrief {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    typeof o.tempHighC === "number" &&
    typeof o.tempLowC === "number" &&
    typeof o.tempAvgC === "number" &&
    typeof o.conditionsSummary === "string" &&
    typeof o.roadConditionsNote === "string" &&
    typeof o.rainDay === "boolean" &&
    typeof o.snowDay === "boolean"
  );
}
