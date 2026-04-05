import { getAppTimezone } from "@/lib/business-timezone";
import {
  formatAppDateWithPreset,
  getDisplayDateFormatPresetForFormatters,
  getIntlLocaleForTimeFromPreset,
} from "@/lib/display-date-format";

/**
 * Format dates consistently across the app (business timezone, default America/Toronto).
 * Presentation follows `platform_config.display_date_format` (see `display-date-format.ts`).
 *
 * Date-only strings (YYYY-MM-DD) are parsed as calendar local dates, then formatted in app TZ.
 */

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export { sameCalendarYearInAppTz } from "@/lib/display-date-format";

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  // YYYY-MM-DD - parse as local date (avoids UTC midnight → previous day in western timezones)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  // "Feb 23" or "Feb 23 2026" - parse as local
  const monthDayMatch = s.match(/^(\w+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?$/i);
  if (monthDayMatch) {
    const [, monthStr, day, yearStr] = monthDayMatch;
    const monthIdx = MONTH_NAMES.indexOf(monthStr.toLowerCase().slice(0, 3));
    if (monthIdx >= 0) {
      const y = yearStr ? Number(yearStr) : new Date().getFullYear();
      return new Date(y, monthIdx, Number(day));
    }
  }
  return new Date(value);
}

function toLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const parsed = parseDateOnly(value);
  return parsed ?? new Date(value);
}

function hasTimePortion(options: Intl.DateTimeFormatOptions): boolean {
  return (
    options.hour !== undefined ||
    options.minute !== undefined ||
    options.second !== undefined
  );
}

/**
 * Platform display in app timezone using the configured date preset. When `options` include
 * hour/minute/second, the date portion uses the preset and the time uses the preset’s Intl locale.
 */
export function formatPlatformDisplay(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  empty: string = "—",
): string {
  if (value == null || value === "") return empty;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return empty;
  const tz = getAppTimezone();
  const preset = getDisplayDateFormatPresetForFormatters();
  const dateStr = formatAppDateWithPreset(d, tz, new Date(), preset);
  if (!hasTimePortion(options)) return dateStr;
  const loc = getIntlLocaleForTimeFromPreset(preset);
  const timeStr = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    hour: options.hour,
    minute: options.minute,
    second: options.second,
    hour12: options.hour12,
    timeZoneName: options.timeZoneName,
  }).format(d);
  return `${dateStr}, ${timeStr}`;
}

export function formatMoveDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  const d = toLocalDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  const tz = getAppTimezone();
  return formatAppDateWithPreset(d, tz, new Date(), getDisplayDateFormatPresetForFormatters());
}

/** Admin tables: created/modified timestamps in app timezone (date + time). */
export function formatAdminCreatedAt(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatPlatformDisplay(d, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
