/**
 * Client-side date/time display aligned with the business timezone (default America/Toronto).
 * Set NEXT_PUBLIC_APP_TIMEZONE to match APP_TIMEZONE on the server.
 */

import { getAppTimezone, utcInstantForCalendarDateInTz } from "@/lib/business-timezone";

export { getAppTimezone };

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  return d.toLocaleDateString("en-US", { timeZone: tz, ...options });
}

export function formatTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  return d.toLocaleTimeString("en-US", { timeZone: tz, ...options });
}

export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  return d.toLocaleString("en-US", { timeZone: tz, ...options });
}

/** Format a calendar YYYY-MM-DD in the given IANA zone (defaults to app timezone) — not browser local. */
export function formatDateYmd(
  ymd: string,
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string,
): string {
  const tz = timeZone?.trim() || getAppTimezone();
  const inst = utcInstantForCalendarDateInTz(ymd, tz);
  if (Number.isNaN(inst.getTime())) return ymd;
  return inst.toLocaleDateString("en-US", { timeZone: tz, ...options });
}
