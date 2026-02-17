/**
 * Format dates consistently across the app.
 * - Short month + day: "Feb 20", "Mar 15"
 * - If different year, append: "Feb 20, 2027"
 * - Never show ISO or raw values in the UI.
 */

export function formatMoveDate(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
