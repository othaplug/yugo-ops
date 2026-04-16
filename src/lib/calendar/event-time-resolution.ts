import { minutesToTime, timeToMinutes } from "@/lib/calendar/types";
import { parsePartnerWindowLabelStartHHMM } from "@/lib/time-windows";

/** Matches admin day grid `DAY_END_HOUR` in DayView (6:00-20:00 visible). */
export const CALENDAR_DAY_END_MINUTES = 20 * 60;

export function normalizeDbTimeToHHMM(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function amPmTo24(h: number, min: string, ap: string): string {
  let hr = h;
  const A = ap.toUpperCase();
  if (A === "PM" && hr !== 12) hr += 12;
  if (A === "AM" && hr === 12) hr = 0;
  return `${String(hr).padStart(2, "0")}:${min}`;
}

/**
 * Parses move "Scheduled Time" dropdown values ("9:00 AM"), 24h "09:00", or TIME strings from Postgres.
 */
export function parseFlexibleTimeToHHMM(t: string | null | undefined): string | null {
  if (!t?.trim()) return null;
  const s = t.trim();
  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    return amPmTo24(parseInt(ampm[1], 10), ampm[2], ampm[3]);
  }
  const slug = s.toLowerCase();
  if (slug === "morning") return "08:00";
  if (slug === "afternoon") return "13:00";
  if (slug === "evening") return "17:00";
  if (slug === "flexible") return "09:00";
  if (slug === "full_day") return "08:00";
  return normalizeDbTimeToHHMM(s);
}

export function clampEndAfterStart(startHHMM: string, endHHMM: string): string {
  const a = timeToMinutes(startHHMM);
  const b = timeToMinutes(endHHMM);
  if (b > a) return endHHMM;
  return minutesToTime(Math.min(a + 30, CALENDAR_DAY_END_MINUTES));
}

/** When only start + duration are known, compute end (capped to calendar day end). */
export function endFromStartAndDurationHours(startHHMM: string, durationHours: number): string {
  const d = Math.max(0.25, durationHours);
  const endMins = timeToMinutes(startHHMM) + Math.round(d * 60);
  return minutesToTime(Math.min(endMins, CALENDAR_DAY_END_MINUTES));
}

export type BlockTimes = { start: string; end: string };

export function buildReferenceBlockTimeMap(
  blocks:
    | {
        reference_type?: string | null;
        reference_id?: string | null;
        block_start?: string | null;
        block_end?: string | null;
      }[]
    | null,
): Map<string, BlockTimes> {
  const map = new Map<string, BlockTimes>();
  for (const b of blocks || []) {
    const rt = b.reference_type;
    const rid = b.reference_id;
    if ((rt !== "move" && rt !== "delivery") || !rid) continue;
    const ns = normalizeDbTimeToHHMM(b.block_start);
    const ne = normalizeDbTimeToHHMM(b.block_end);
    if (ns && ne) {
      map.set(`${rt}:${rid}`, { start: ns, end: ne });
    }
  }
  return map;
}

export function resolveMoveDisplayTimes(args: {
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduledTimeText: string | null;
  preferredTime: string | null;
  arrivalWindowLabel: string | null;
  block: BlockTimes | null;
  estimatedDurationMinutes: number | null;
  estHours: number | null;
  baselineHours: number;
}): { start: string | null; end: string | null; durationHours: number | null } {
  const s0 = normalizeDbTimeToHHMM(args.scheduledStart);
  const e0 = normalizeDbTimeToHHMM(args.scheduledEnd);
  const blk = args.block;

  let start =
    s0 ||
    parseFlexibleTimeToHHMM(args.scheduledTimeText) ||
    parseFlexibleTimeToHHMM(args.preferredTime) ||
    parsePartnerWindowLabelStartHHMM(args.arrivalWindowLabel);

  let end = e0;

  if (!start && blk?.start) {
    start = blk.start;
    if (!end) end = blk.end ?? null;
  }

  const durationFromMinutes =
    args.estimatedDurationMinutes != null && Number.isFinite(Number(args.estimatedDurationMinutes))
      ? Math.max(0.25, Number(args.estimatedDurationMinutes) / 60)
      : null;
  const durationFromEst =
    args.estHours != null && Number.isFinite(Number(args.estHours)) ? Number(args.estHours) : null;
  const baseDur = durationFromMinutes ?? durationFromEst ?? args.baselineHours;

  if (start && !end) {
    end = endFromStartAndDurationHours(start, baseDur);
  }

  if (start && end) {
    end = clampEndAfterStart(start, end);
  }

  return {
    start,
    end,
    durationHours: start && !end ? baseDur : null,
  };
}

export function resolveDeliveryDisplayTimes(args: {
  scheduledStart: string | null;
  scheduledEnd: string | null;
  timeSlot: string | null;
  block: BlockTimes | null;
  estimatedDurationMinutes: number | null;
  estimatedDurationHours: number | null;
  typeDefaultHours: number;
}): { start: string | null; end: string | null; durationHours: number | null } {
  const s0 = normalizeDbTimeToHHMM(args.scheduledStart);
  const e0 = normalizeDbTimeToHHMM(args.scheduledEnd);
  const fromSlot =
    parseFlexibleTimeToHHMM(args.timeSlot) || parsePartnerWindowLabelStartHHMM(args.timeSlot);

  let start = s0 || fromSlot;
  let end = e0;

  const blk = args.block;
  if (!start && blk?.start) {
    start = blk.start;
    if (!end) end = blk.end ?? null;
  }

  const durationFromMinutes =
    args.estimatedDurationMinutes != null && Number.isFinite(Number(args.estimatedDurationMinutes))
      ? Math.max(0.25, Number(args.estimatedDurationMinutes) / 60)
      : null;
  const durationFromEst =
    args.estimatedDurationHours != null && Number.isFinite(Number(args.estimatedDurationHours))
      ? Number(args.estimatedDurationHours)
      : null;
  const baseDur = durationFromMinutes ?? durationFromEst ?? args.typeDefaultHours;

  if (start && !end) {
    end = endFromStartAndDurationHours(start, baseDur);
  }

  if (start && end) {
    end = clampEndAfterStart(start, end);
  }

  return {
    start,
    end,
    durationHours: start && !end ? baseDur : null,
  };
}
