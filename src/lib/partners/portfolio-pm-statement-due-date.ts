/** Eastern (Toronto) calendar day extracted from any ISO timestamp. */
const easternWallParts = (
  iso: string | null | undefined,
): { year: number; month: number; day: number } => {
  const d = iso?.trim()
    ? new Date(iso)
    : new Date();
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, mo, dy] = s.split("-").map((x) => Number(x.trim()));
  return { year: y, month: mo, day: dy };
};

const daysInMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate();

/**
 * Portfolio PM partner cadence (Springfield-style):
 * Completed on days 1–14 (Eastern): due on day 15 of that month (clamped to month length).
 * Completed on days 15–29: due on calendar day 30 of that month, or the last day of the month when shorter than 30 (e.g. February).
 * Completed on day 30 or 31: due on day 15 of the following calendar month (clamped).
 */
export function portfolioPmStatementInvoiceDueIso(
  completedAtIso: string | null | undefined,
): string {
  const { year: y, month: m, day: dm } = easternWallParts(completedAtIso);
  let targetYear = y;
  let targetMonth = m;
  let targetDay: number;

  if (dm < 15) {
    targetDay = 15;
  } else if (dm < 30) {
    targetDay = Math.min(30, daysInMonth(y, m));
  } else {
    targetDay = 15;
    if (m === 12) {
      targetYear = y + 1;
      targetMonth = 1;
    } else {
      targetMonth = m + 1;
    }
  }

  targetDay = Math.min(targetDay, daysInMonth(targetYear, targetMonth));
  const mm = String(targetMonth).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}
