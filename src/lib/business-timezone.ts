/**
 * Single business timezone for the whole app (admin, partner, crew).
 * Use for "today", date filtering, and date display so all platforms show the same day.
 *
 * Set APP_TIMEZONE in .env (e.g. America/Toronto, America/New_York). Defaults to America/Toronto.
 */

const DEFAULT_TZ = "America/Toronto";

export function getAppTimezone(): string {
  return (
    process.env.APP_TIMEZONE ||
    process.env.BUSINESS_TIMEZONE ||
    process.env.CREW_DASHBOARD_TIMEZONE ||
    DEFAULT_TZ
  ).trim() || DEFAULT_TZ;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const d = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

/** Human-readable date in the app timezone (e.g. "Sunday, Mar 2"). */
export function getLocalDateDisplay(date: Date, timeZone?: string): string {
  const tz = timeZone ?? getAppTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${weekday}, ${month} ${day}`;
}
