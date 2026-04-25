import type { CalendarEvent } from "./types";
import { timeToMinutes } from "./types";

/**
 * GCal-style horizontal placement: overlapping timed events get split columns
 * (constant width = max concurrent count during the event's span; column = index
 * at event start among concurrent events, sorted by start + id).
 */
export function getWeekEventHorizontalLayout(
  dayEvents: CalendarEvent[],
  ev: CalendarEvent,
): { leftPct: number; widthPct: number; columnIndex: number; columnCount: number } {
  const withTime = dayEvents.filter((e) => e.start && e.end);
  if (withTime.length === 0 || !ev.start || !ev.end) {
    return { leftPct: 0, widthPct: 100, columnIndex: 0, columnCount: 1 };
  }

  const countAt = (t: number) =>
    withTime.filter((x) => {
      if (!x.start || !x.end) return false;
      return timeToMinutes(x.start) <= t && timeToMinutes(x.end) > t;
    }).length;

  const s = timeToMinutes(ev.start);
  const e = timeToMinutes(ev.end);
  let maxN = 1;
  for (let t = s; t < e; t += 1) {
    maxN = Math.max(maxN, countAt(t));
  }
  const n = Math.max(1, maxN);

  const t0 = s;
  const atStart = withTime
    .filter((x) => {
      if (!x.start || !x.end) return false;
      return timeToMinutes(x.start) <= t0 && timeToMinutes(x.end) > t0;
    })
    .sort((a, b) => {
      const c = timeToMinutes(a.start!) - timeToMinutes(b.start!);
      if (c !== 0) return c;
      return a.id.localeCompare(b.id);
    });
  const col = Math.max(0, atStart.findIndex((x) => x.id === ev.id));

  return {
    leftPct: n <= 1 ? 0 : (col / n) * 100,
    widthPct: 100 / n,
    columnIndex: col,
    columnCount: n,
  };
}

export function getWeekEventLayouts(
  dayEvents: CalendarEvent[],
): Map<string, { leftPct: number; widthPct: number; columnIndex: number; columnCount: number }> {
  const withTime = dayEvents.filter((e) => e.start && e.end);
  const map = new Map<
    string,
    { leftPct: number; widthPct: number; columnIndex: number; columnCount: number }
  >();
  for (const ev of withTime) {
    map.set(ev.id, getWeekEventHorizontalLayout(withTime, ev));
  }
  return map;
}
