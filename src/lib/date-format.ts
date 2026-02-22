/**
 * Format dates consistently across the app.
 * - Short month + day: "Feb 20", "Mar 15"
 * - If different year, append: "Feb 20, 2027"
 * - Never show ISO or raw values in the UI.
 *
 * Date-only strings (YYYY-MM-DD) are parsed as local dates to avoid timezone shift:
 * "2026-02-23" → Feb 23 local, not Feb 22 (which happens when parsed as UTC midnight).
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
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
