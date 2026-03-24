import { getAppTimezone } from "@/lib/business-timezone";

/**
 * Format dates consistently across the app (business timezone, default America/Toronto).
 * - Short month + day: "Feb 20", "Mar 15"
 * - If different year, append: "Feb 20, 2027"
 * - Never show ISO or raw values in the UI.
 *
 * Date-only strings (YYYY-MM-DD) are parsed as calendar local dates, then formatted in app TZ.
 */

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

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

export function formatMoveDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "-";
  const d = toLocalDate(value);
  if (Number.isNaN(d.getTime())) return "-";
  const tz = getAppTimezone();
  const now = new Date();
  const yNow = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(now);
  const yD = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(d);
  const sameYear = yNow === yD;
  return sameYear
    ? d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" })
    : d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });
}

/** Admin tables: created/modified timestamps in app timezone (date + time). */
export function formatAdminCreatedAt(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const tz = getAppTimezone();
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
