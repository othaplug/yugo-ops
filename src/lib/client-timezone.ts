/**
 * Client-side date/time display aligned with the business timezone (default America/Toronto).
 * Set NEXT_PUBLIC_APP_TIMEZONE to match APP_TIMEZONE on the server.
 */

import { getAppTimezone, utcInstantForCalendarDateInTz } from "@/lib/business-timezone";
import {
  formatAdminCreatedAt,
  formatMoveDate,
  formatPlatformDisplay,
} from "@/lib/date-format";
import {
  formatAppDateWithPreset,
  getDisplayDateFormatPresetForFormatters,
} from "@/lib/display-date-format";
import { getDisplayDateLocaleForFormatters } from "@/lib/display-date-locale";

export { getAppTimezone };
export { formatAdminCreatedAt, formatMoveDate, formatPlatformDisplay, sameCalendarYearInAppTz } from "@/lib/date-format";

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  const preset = getDisplayDateFormatPresetForFormatters();
  if (!options || Object.keys(options).length === 0) {
    return formatAppDateWithPreset(d, tz, new Date(), preset);
  }
  if (options.weekday !== undefined) {
    const loc = getDisplayDateLocaleForFormatters();
    return new Intl.DateTimeFormat(loc, { timeZone: tz, ...options }).format(d);
  }
  return formatAppDateWithPreset(d, tz, new Date(), preset);
}

export function formatTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  const loc = getDisplayDateLocaleForFormatters();
  return d.toLocaleTimeString(loc, { timeZone: tz, ...options });
}

export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const tz = getAppTimezone();
  const loc = getDisplayDateLocaleForFormatters();
  return d.toLocaleString(loc, { timeZone: tz, ...options });
}

/**
 * Format a calendar YYYY-MM-DD in the given IANA zone (defaults to app timezone) — not browser local.
 * Uses the platform date preset unless `options` set `year` explicitly or include `weekday` (Intl override).
 */
export function formatDateYmd(
  ymd: string,
  options?: Intl.DateTimeFormatOptions,
  timeZone?: string,
): string {
  const tz = timeZone?.trim() || getAppTimezone();
  const inst = utcInstantForCalendarDateInTz(ymd, tz);
  if (Number.isNaN(inst.getTime())) return ymd;
  const preset = getDisplayDateFormatPresetForFormatters();
  const loc = getDisplayDateLocaleForFormatters();
  if (options && options.year !== undefined) {
    return new Intl.DateTimeFormat(loc, { timeZone: tz, ...options }).format(inst);
  }
  if (options && options.weekday !== undefined) {
    return new Intl.DateTimeFormat(loc, { timeZone: tz, ...options }).format(inst);
  }
  return formatAppDateWithPreset(inst, tz, new Date(), preset);
}
