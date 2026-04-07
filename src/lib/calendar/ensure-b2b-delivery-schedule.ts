import type { SupabaseClient } from "@supabase/supabase-js";
import { checkCrewConflict, createScheduleBlock } from "@/lib/calendar/conflict-check";
import { minutesToTime, timeToMinutes } from "@/lib/calendar/types";
import {
  parsePartnerWindowLabelEndHHMM,
  parsePartnerWindowLabelStartHHMM,
} from "@/lib/time-windows";

const CAL_DAY_END_MINS = 20 * 60;
const CANCELLED = new Set(["cancelled", "canceled"]);

export function isDeliveryB2bCategory(category: string | null | undefined): boolean {
  const c = (category || "").toLowerCase().trim();
  return c === "b2b" || c.startsWith("b2b_");
}

function normalizeDbTimeToHHMM(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseTwelveHourSlot(slot: string | null | undefined): string | null {
  if (!slot) return null;
  const s = slot.trim().toLowerCase();
  if (s === "morning") return "08:00";
  if (s === "afternoon") return "13:00";
  if (s === "evening") return "17:00";
  if (s === "flexible") return "09:00";
  if (s === "full_day") return "08:00";
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
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

function addHoursToTime(startHHMM: string, hours: number): string {
  const startM = timeToMinutes(startHHMM);
  const rawEnd = startM + Math.round(hours * 60);
  const endM = Math.min(Math.max(rawEnd, startM + 30), CAL_DAY_END_MINS);
  return minutesToTime(endM);
}

function inferStartEnd(row: {
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  time_slot?: string | null;
  delivery_window?: string | null;
  estimated_duration_hours?: number | null;
  day_type?: string | null;
}): { start: string; end: string } {
  const sDb = normalizeDbTimeToHHMM(row.scheduled_start);
  const eDb = normalizeDbTimeToHHMM(row.scheduled_end);
  if (sDb && eDb) return { start: sDb, end: eDb };

  const start =
    sDb ||
    parseTwelveHourSlot(row.time_slot) ||
    parsePartnerWindowLabelStartHHMM(row.time_slot) ||
    parsePartnerWindowLabelStartHHMM(row.delivery_window) ||
    "08:00";

  let end =
    eDb ||
    parsePartnerWindowLabelEndHHMM(row.time_slot) ||
    parsePartnerWindowLabelEndHHMM(row.delivery_window) ||
    null;
  if (!end) {
    end = addHoursToTime(start, b2bDefaultDurationHours(row));
  }
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    end = addHoursToTime(start, Math.max(1, b2bDefaultDurationHours(row)));
  }
  return { start, end };
}

/**
 * Ensures B2B deliveries have structured scheduled_start / scheduled_end for the admin calendar
 * and syncs crew_schedule_blocks when a crew is assigned (conflict-safe).
 */
export async function ensureB2bDeliverySchedule(
  supabase: SupabaseClient,
  deliveryId: string,
): Promise<{ skipped: boolean; reason?: string; timesWritten?: boolean; blockSynced?: boolean }> {
  const { data: row, error } = await supabase
    .from("deliveries")
    .select(
      "id, category, status, scheduled_date, scheduled_start, scheduled_end, time_slot, delivery_window, crew_id, estimated_duration_hours, day_type",
    )
    .eq("id", deliveryId)
    .single();

  if (error || !row) return { skipped: true, reason: "not_found" };
  if (!isDeliveryB2bCategory(row.category as string)) return { skipped: true, reason: "not_b2b" };
  if (CANCELLED.has(String(row.status || "").toLowerCase())) return { skipped: true, reason: "cancelled" };
  if (!row.scheduled_date) return { skipped: true, reason: "no_date" };

  const { start, end } = inferStartEnd({
    scheduled_start: row.scheduled_start as string | null,
    scheduled_end: row.scheduled_end as string | null,
    time_slot: row.time_slot as string | null,
    delivery_window: row.delivery_window as string | null,
    estimated_duration_hours: row.estimated_duration_hours as number | null,
    day_type: row.day_type as string | null,
  });

  const prevS = normalizeDbTimeToHHMM(row.scheduled_start as string | null);
  const prevE = normalizeDbTimeToHHMM(row.scheduled_end as string | null);
  const needsTimes = prevS !== start || prevE !== end;

  let timesWritten = false;
  if (needsTimes) {
    const { error: upErr } = await supabase
      .from("deliveries")
      .update({
        scheduled_start: start,
        scheduled_end: end,
      })
      .eq("id", deliveryId);
    if (upErr) {
      console.error("[ensureB2bDeliverySchedule] update times failed:", upErr.message);
      return { skipped: true, reason: "update_failed" };
    }
    timesWritten = true;
  }

  const crewId = row.crew_id as string | null;
  if (!crewId) {
    await supabase.from("crew_schedule_blocks").delete().eq("reference_type", "delivery").eq("reference_id", deliveryId);
    return { skipped: false, timesWritten, blockSynced: false };
  }

  const dateStr = String(row.scheduled_date).slice(0, 10);
  const { data: existingBlock } = await supabase
    .from("crew_schedule_blocks")
    .select("id")
    .eq("reference_type", "delivery")
    .eq("reference_id", deliveryId)
    .maybeSingle();

  try {
    if (existingBlock?.id) {
      const conflict = await checkCrewConflict(
        supabase,
        { crew_id: crewId, date: dateStr, start, end },
        existingBlock.id,
      );
      if (conflict.hasConflict) {
        console.warn("[ensureB2bDeliverySchedule] crew conflict; block not updated", deliveryId);
        return { skipped: false, timesWritten, blockSynced: false };
      }
      const { error: bErr } = await supabase
        .from("crew_schedule_blocks")
        .update({
          crew_id: crewId,
          block_date: dateStr,
          block_start: start,
          block_end: end,
        })
        .eq("id", existingBlock.id);
      if (bErr) {
        console.error("[ensureB2bDeliverySchedule] block update failed:", bErr.message);
        return { skipped: false, timesWritten, blockSynced: false };
      }
      return { skipped: false, timesWritten, blockSynced: true };
    }

    await createScheduleBlock(supabase, {
      crew_id: crewId,
      date: dateStr,
      start,
      end,
      type: "delivery",
      reference_id: deliveryId,
    });
    return { skipped: false, timesWritten, blockSynced: true };
  } catch (e) {
    console.warn("[ensureB2bDeliverySchedule] block sync failed:", e);
    return { skipped: false, timesWritten, blockSynced: false };
  }
}
