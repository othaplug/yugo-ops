import {
  getAppTimezone,
  getLocalClockPartsInAppTimezone,
  ymdPartsInTimeZone,
} from "@/lib/business-timezone";
import { timeToMinutes, minutesToTime } from "@/lib/calendar/types";

const CAL_DAY_END_MINS = 20 * 60;

function pad2h(n: number): string {
  return String(Math.min(23, Math.max(0, n))).padStart(2, "0");
}
function pad2m(n: number): string {
  return String(Math.min(59, Math.max(0, n))).padStart(2, "0");
}

/** Normalize DB time "HH:MM" or "H:MM:SS". */
function normalizeDbTimeToHHMM(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${pad2h(h)}:${pad2m(min)}`;
}

function parseTwelveHourToken(hStr: string, minStr: string | undefined, ap: string): string | null {
  let h = parseInt(hStr, 10);
  if (!Number.isFinite(h)) return null;
  const min = minStr != null && minStr !== "" ? Math.min(59, Math.max(0, parseInt(minStr, 10))) : 0;
  const apu = ap.toUpperCase();
  if (apu === "PM" && h !== 12) h += 12;
  if (apu === "AM" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return `${pad2h(h)}:${pad2m(min)}`;
}

function parseTwelveHourSlot(slot: string | null | undefined): string | null {
  if (!slot) return null;
  const s = slot.trim().toLowerCase();
  if (s === "morning") return "08:00";
  if (s === "afternoon") return "13:00";
  if (s === "evening") return "17:00";
  if (s === "flexible") return "09:00";
  const m = slot.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  return parseTwelveHourToken(m[1], m[2], m[3]);
}

/** First "7 AM" / "7:00 AM" style time in string → HH:MM. */
export function parseWindowStart(win: string | null | undefined): string | null {
  if (!win) return null;
  const m = win.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return null;
  return parseTwelveHourToken(m[1], m[2], m[3]);
}

/** Last such time in string (end of range). */
export function parseWindowEnd(win: string | null | undefined): string | null {
  if (!win) return null;
  const matches = [...win.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length < 2) return null;
  const last = matches[matches.length - 1];
  return parseTwelveHourToken(last[1], last[2], last[3]);
}

function addHoursToTime(startHHMM: string, hours: number): string {
  const startM = timeToMinutes(startHHMM);
  const rawEnd = startM + Math.round(hours * 60);
  const endM = Math.min(Math.max(rawEnd, startM + 30), CAL_DAY_END_MINS);
  return minutesToTime(endM);
}

function b2bDefaultDurationHours(row: {
  estimated_duration_hours?: number | null;
  day_type?: string | null;
}): number {
  const dt = (row.day_type || "").toLowerCase();
  if (dt === "full_day") return 9;
  if (dt === "half_day") return 4;
  const est = row.estimated_duration_hours;
  if (est != null && Number.isFinite(Number(est)) && Number(est) > 0) {
    return Math.min(Math.max(Number(est), 0.5), 12);
  }
  return 4;
}

function inferDeliveryStartEnd(row: {
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  time_slot?: string | null;
  delivery_window?: string | null;
  estimated_duration_hours?: number | null;
  day_type?: string | null;
}): { start: string; end: string } | null {
  const sDb = normalizeDbTimeToHHMM(row.scheduled_start);
  const eDb = normalizeDbTimeToHHMM(row.scheduled_end);
  if (sDb && eDb) return { start: sDb, end: eDb };

  const start =
    sDb ||
    parseTwelveHourSlot(row.time_slot) ||
    parseWindowStart(row.delivery_window) ||
    null;
  if (!start) return null;

  let end = eDb || parseWindowEnd(row.delivery_window) || null;
  if (!end) {
    end = addHoursToTime(start, b2bDefaultDurationHours(row));
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    end = addHoursToTime(start, Math.max(1, b2bDefaultDurationHours(row)));
  }
  return { start, end };
}

function normalizeYmd(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Pickup window for residential moves (arrival_window preferred, else scheduled_time). */
export function parseMoveScheduleWindow(row: {
  scheduled_date?: string | null;
  arrival_window?: string | null;
  scheduled_time?: string | null;
}): { scheduledYmd: string; startMin: number; endMin: number } | null {
  const scheduledYmd = normalizeYmd(row.scheduled_date ?? null);
  if (!scheduledYmd) return null;

  const winStr =
    (row.arrival_window && String(row.arrival_window).trim()) ||
    (row.scheduled_time && String(row.scheduled_time).trim()) ||
    "";
  if (!winStr) return null;

  const startHH = parseWindowStart(winStr);
  const endHH = parseWindowEnd(winStr);
  if (startHH && endHH) {
    const startMin = timeToMinutes(startHH);
    const endMin = timeToMinutes(endHH);
    if (endMin < startMin) return null;
    return { scheduledYmd, startMin, endMin };
  }
  if (startHH && !endHH) {
    const startMin = timeToMinutes(startHH);
    const endMin = Math.min(startMin + 120, CAL_DAY_END_MINS);
    return { scheduledYmd, startMin, endMin };
  }
  return null;
}

export function parseDeliveryScheduleWindow(row: {
  scheduled_date?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  time_slot?: string | null;
  delivery_window?: string | null;
  estimated_duration_hours?: number | null;
  day_type?: string | null;
}): { scheduledYmd: string; startMin: number; endMin: number } | null {
  const scheduledYmd = normalizeYmd(row.scheduled_date ?? null);
  if (!scheduledYmd) return null;

  const se = inferDeliveryStartEnd(row);
  if (!se) return null;
  return {
    scheduledYmd,
    startMin: timeToMinutes(se.start),
    endMin: timeToMinutes(se.end),
  };
}

/**
 * true = on scheduled calendar day and arrived by end of commitment window (early same day counts as on time);
 * false = after window end on scheduled day, or arrival on a later calendar day than scheduled;
 * null = cannot score (arrival before scheduled calendar day, invalid data).
 */
export function evaluateArrivalVsCommitmentWindow(args: {
  scheduledYmd: string;
  startMin: number;
  endMin: number;
  arrivalIso: string;
  timeZone?: string;
}): boolean | null {
  void args.startMin;
  const tz = args.timeZone ?? getAppTimezone();
  const arrivalMs = new Date(args.arrivalIso).getTime();
  if (!Number.isFinite(arrivalMs)) return null;

  const arrivalYmd = ymdPartsInTimeZone(arrivalMs, tz);
  const { hour, minute } = getLocalClockPartsInAppTimezone(new Date(arrivalMs), tz);
  const arrivalMin = hour * 60 + minute;

  if (arrivalYmd < args.scheduledYmd) return null;
  if (arrivalYmd > args.scheduledYmd) return false;
  if (arrivalMin > args.endMin) return false;
  return true;
}

export type TrackingCheckpoint = { status?: string; timestamp?: string };

export function firstCheckpointTimestamp(
  checkpoints: unknown,
  status: string
): string | null {
  if (!Array.isArray(checkpoints)) return null;
  for (const c of checkpoints) {
    if (!c || typeof c !== "object") continue;
    const st = (c as TrackingCheckpoint).status;
    const ts = (c as TrackingCheckpoint).timestamp;
    if (st === status && typeof ts === "string" && ts.trim()) return ts.trim();
  }
  return null;
}
