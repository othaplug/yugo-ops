/**
 * Parse time window strings (e.g. "8 AM - 10 AM", "9:00 AM") into start/end timestamps
 * for a given date. Used for on-time (Option A) arrival-within-window checks.
 */

/** Result: start and end timestamps in ms for the window on the given date */
export type ParsedWindow = { startMs: number; endMs: number } | null;

const RE_RANGE = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i;
const RE_SINGLE = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i;
/** "Morning (7 AM – 12 PM)" style */
const RE_NAMED = /\((\d{1,2})\s*(AM|PM)\s*[-–—]\s*(\d{1,2})\s*(AM|PM)\)/i;

function to24(h: number, ampm: string): number {
  const u = ampm.toUpperCase();
  if (u === "AM") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

function parseTimePart(m: RegExpMatchArray, hourIdx: number, minIdx: number, ampmIdx: number): { h: number; m: number } {
  const h = parseInt(m[hourIdx] || "0", 10);
  const mVal = m[minIdx];
  const min = mVal != null ? parseInt(mVal, 10) : 0;
  const h24 = to24(h, m[ampmIdx] || "AM");
  return { h: h24, m: min };
}

/**
 * Parse a time window string and return start/end timestamps for the given date (YYYY-MM-DD).
 * - "8 AM - 10 AM" → 8:00–10:00
 * - "9:00 AM" → 8:30–9:30 (±30 min)
 * - "Morning (7 AM – 12 PM)" → 7:00–12:00
 * Returns null if unparseable.
 */
export function parseTimeWindow(windowStr: string | null | undefined, dateStr: string): ParsedWindow {
  if (!windowStr || typeof windowStr !== "string") return null;
  const s = windowStr.trim();
  if (!s) return null;

  const [y, mo, d] = dateStr.split("-").map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return null;

  // Range: "8 AM - 10 AM" or "8:30 AM – 10:30 AM"
  const rangeMatch = s.match(RE_RANGE);
  if (rangeMatch) {
    const start = parseTimePart(rangeMatch, 1, 2, 3);
    const end = parseTimePart(rangeMatch, 4, 5, 6);
    const startMs = new Date(y, mo - 1, d, start.h, start.m, 0, 0).getTime();
    const endMs = new Date(y, mo - 1, d, end.h, end.m, 0, 0).getTime();
    if (endMs <= startMs) return null;
    return { startMs, endMs };
  }

  // Named: "Morning (7 AM – 12 PM)"
  const namedMatch = s.match(RE_NAMED);
  if (namedMatch) {
    const startH = to24(parseInt(namedMatch[1], 10), namedMatch[2]);
    const endH = to24(parseInt(namedMatch[3], 10), namedMatch[4]);
    const startMs = new Date(y, mo - 1, d, startH, 0, 0, 0).getTime();
    const endMs = new Date(y, mo - 1, d, endH, 0, 0, 0).getTime();
    if (endMs <= startMs) return null;
    return { startMs, endMs };
  }

  // Single time: "9:00 AM" → ±30 min window
  const singleMatch = s.match(RE_SINGLE);
  if (singleMatch) {
    const { h, m } = parseTimePart(singleMatch, 1, 2, 3);
    const centerMs = new Date(y, mo - 1, d, h, m, 0, 0).getTime();
    const half = 30 * 60 * 1000;
    return { startMs: centerMs - half, endMs: centerMs + half };
  }

  return null;
}

/** Arrival checkpoints in order of preference (first found wins) */
export const ARRIVAL_CHECKPOINTS_MOVE = ["arrived_at_pickup", "arrived_on_site", "arrived"] as const;
export const ARRIVAL_CHECKPOINTS_DELIVERY = ["arrived_at_destination", "arrived_on_site", "arrived"] as const;

/** Grace: 15 min early / 15 min late */
const GRACE_MS = 15 * 60 * 1000;

/**
 * Check if arrival timestamp falls within the window (with grace).
 */
export function isArrivalWithinWindow(
  arrivalMs: number,
  parsed: ParsedWindow,
  graceMs: number = GRACE_MS
): boolean {
  if (!parsed) return false;
  return arrivalMs >= parsed.startMs - graceMs && arrivalMs <= parsed.endMs + graceMs;
}
