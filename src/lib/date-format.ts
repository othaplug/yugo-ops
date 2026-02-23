/**
 * Format dates consistently across the app.
 * - Short month + day: "Feb 20", "Mar 15"
 * - If different year, append: "Feb 20, 2027"
 * - Never show ISO or raw values in the UI.
 *
 * Date-only strings (YYYY-MM-DD) are parsed as local dates to avoid timezone shift:
 * "2026-02-23" → Feb 23 local, not Feb 22 (which happens when parsed as UTC midnight).
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
  if (value == null || value === "") return "—";
  const d = toLocalDate(value);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
