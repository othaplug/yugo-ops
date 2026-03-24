/**
 * Single business timezone for the whole app (admin, partner, crew).
 * Use for "today", date filtering, and date display so all platforms show the same day.
 *
 * Set APP_TIMEZONE (server) and NEXT_PUBLIC_APP_TIMEZONE (browser) to the same IANA zone,
 * e.g. America/Toronto. Defaults to America/Toronto everywhere.
 */

export const DEFAULT_APP_TIMEZONE = "America/Toronto";

export function getAppTimezone(): string {
  // Browser bundles only embed NEXT_PUBLIC_* — prefer that on the client so labels match build-time public config.
  if (typeof window !== "undefined" && typeof process !== "undefined" && process.env) {
    const pub = process.env.NEXT_PUBLIC_APP_TIMEZONE;
    if (pub && String(pub).trim()) return String(pub).trim();
    return DEFAULT_APP_TIMEZONE;
  }
  if (typeof process !== "undefined" && process.env) {
    const e = process.env;
    const from =
      e.APP_TIMEZONE ||
      e.BUSINESS_TIMEZONE ||
      e.CREW_DASHBOARD_TIMEZONE ||
      e.NEXT_PUBLIC_APP_TIMEZONE;
    if (from && String(from).trim()) return String(from).trim();
  }
  return DEFAULT_APP_TIMEZONE;
}

/** Hour 0–23 in the app timezone (e.g. greetings, "business now"). */
export function getLocalHourInAppTimezone(date: Date = new Date(), timeZone?: string): number {
  const tz = timeZone ?? getAppTimezone();
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(date)
    .find((p) => p.type === "hour")?.value;
  return Math.min(23, Math.max(0, parseInt(h ?? "0", 10)));
}

/** YYYY-MM-DD for the calendar day of `tMs` in `timeZone` (canonical; use for DB filters and "today"). */
export function ymdPartsInTimeZone(tMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(tMs));
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

/**
 * A UTC instant that falls on the given calendar YYYY-MM-DD in `timeZone`
 * (for stable display across browsers).
 */
export function utcInstantForCalendarDateInTz(ymd: string, timeZone: string): Date {
  const target = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return new Date(NaN);
  const [ys, ms, ds] = target.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  const d = Number(ds);
  let t = Date.UTC(y, mo - 1, d, 12, 0, 0);
  for (let i = 0; i < 48; i++) {
    const got = ymdPartsInTimeZone(t, timeZone);
    if (got === target) return new Date(t);
    if (got < target) t += 3600000;
    else t -= 3600000;
  }
  return new Date(t);
}

/** Add calendar days to a YYYY-MM-DD string in the app timezone (Gregorian date math). */
export function addCalendarDaysYmd(ymd: string, days: number, timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utc = new Date(Date.UTC(y, mo - 1, d + days, 12, 0, 0));
  return getLocalDateString(utc, tz);
}

/** Today's date (YYYY-MM-DD) in the app timezone. Use for DB filters and "today" logic. */
export function getTodayString(timeZone?: string): string {
  return getLocalDateString(new Date(), timeZone ?? getAppTimezone());
}

/** First day of current month (YYYY-MM-DD) in the app timezone. */
export function getMonthStartString(date: Date = new Date(), timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  return `${y}-${m}-01`;
}

/** Format a date as YYYY-MM-DD in the given timezone. */
export function getLocalDateString(date: Date, timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  return ymdPartsInTimeZone(date.getTime(), tz);
}

/** Short zone label for UI, e.g. "EST" / "EDT" (depends on `at` for DST). */
export function getTimeZoneShortLabel(at: Date = new Date(), timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(at);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
}

/** Human-readable date in the app timezone (e.g. "Sunday, Mar 2"). */
export function getLocalDateDisplay(date: Date, timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "2-digit",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${weekday}, ${month} ${day}`;
}
