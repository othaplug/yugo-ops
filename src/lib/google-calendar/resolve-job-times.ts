import "server-only";
import {
  resolveMoveDisplayTimes,
  resolveDeliveryDisplayTimes,
  buildReferenceBlockTimeMap,
  type BlockTimes,
} from "@/lib/calendar/event-time-resolution";
import { timeToMinutes } from "@/lib/calendar/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolved start/duration for a job, using the SAME fallback chain as the
 * OPS+ internal calendar (`/api/admin/calendar`).
 *
 * Returns null start when the job genuinely has no scheduled time anywhere.
 */
export type ResolvedJobTimes = {
  startHHMM: string | null;
  durationMinutes: number | null;
};

const DEFAULT_MOVE_BASELINE_HOURS = 4;
const DEFAULT_DELIVERY_HOURS = 1.5;

export function resolveMoveJobTimes(
  m: Record<string, unknown>,
  block: BlockTimes | null,
  baselineHoursBySize: Map<string, number>,
): ResolvedJobTimes {
  const moveSize = (m.move_size as string | null)?.toLowerCase() || "";
  const baselineHours =
    baselineHoursBySize.get(moveSize) ??
    baselineHoursBySize.get("2br") ??
    DEFAULT_MOVE_BASELINE_HOURS;

  const r = resolveMoveDisplayTimes({
    scheduledStart: (m.scheduled_start as string | null) || null,
    scheduledEnd: (m.scheduled_end as string | null) || null,
    scheduledTimeText: (m.scheduled_time as string | null) || null,
    preferredTime: (m.preferred_time as string | null) || null,
    arrivalWindowLabel: (m.arrival_window as string | null) || null,
    block,
    estimatedDurationMinutes:
      m.estimated_duration_minutes != null && Number.isFinite(Number(m.estimated_duration_minutes))
        ? Number(m.estimated_duration_minutes)
        : null,
    estHours: m.est_hours != null ? Number(m.est_hours) : null,
    baselineHours,
  });

  return computeDuration(r);
}

export function resolveDeliveryJobTimes(
  d: Record<string, unknown>,
  block: BlockTimes | null,
  typeDefaultHoursByType: Map<string, number>,
): ResolvedJobTimes {
  const delTypeRaw =
    ((d.delivery_type || d.category) as string | null)?.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") ||
    "standard";
  const typeDefaultHours =
    typeDefaultHoursByType.get(delTypeRaw) ?? typeDefaultHoursByType.get("standard") ?? DEFAULT_DELIVERY_HOURS;

  const r = resolveDeliveryDisplayTimes({
    scheduledStart: (d.scheduled_start as string | null) || null,
    scheduledEnd: (d.scheduled_end as string | null) || null,
    timeSlot: (d.time_slot as string | null) || null,
    block,
    estimatedDurationMinutes:
      d.estimated_duration_minutes != null && Number.isFinite(Number(d.estimated_duration_minutes))
        ? Number(d.estimated_duration_minutes)
        : null,
    estimatedDurationHours: d.estimated_duration_hours != null ? Number(d.estimated_duration_hours) : null,
    typeDefaultHours,
  });

  return computeDuration(r);
}

function computeDuration(r: { start: string | null; end: string | null; durationHours: number | null }): ResolvedJobTimes {
  if (!r.start) return { startHHMM: null, durationMinutes: null };
  if (r.end) {
    const mins = Math.max(15, timeToMinutes(r.end) - timeToMinutes(r.start));
    return { startHHMM: r.start, durationMinutes: mins };
  }
  if (r.durationHours != null) {
    return { startHHMM: r.start, durationMinutes: Math.round(r.durationHours * 60) };
  }
  return { startHHMM: r.start, durationMinutes: null };
}

/**
 * Fetch the crew schedule block for a single move or delivery, returning a
 * BlockTimes if both block_start and block_end are set. Used by the auto-sync
 * triggers (`triggerMoveGCalSync` / `triggerDeliveryGCalSync`).
 */
export async function fetchSingleJobBlock(
  refType: "move" | "delivery",
  refId: string,
): Promise<BlockTimes | null> {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("crew_schedule_blocks")
      .select("block_start, block_end")
      .eq("reference_type", refType)
      .eq("reference_id", refId)
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const map = buildReferenceBlockTimeMap([
      { reference_type: refType, reference_id: refId, block_start: data.block_start, block_end: data.block_end },
    ]);
    return map.get(`${refType}:${refId}`) ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch all volume_benchmarks rows as a Map<move_size, baseline_hours>.
 */
export async function fetchBaselineHoursBySize(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const db = createAdminClient();
    const { data } = await db.from("volume_benchmarks").select("move_size, baseline_hours");
    for (const row of data || []) {
      if (row.move_size) {
        map.set(String(row.move_size).toLowerCase(), Number(row.baseline_hours) || DEFAULT_MOVE_BASELINE_HOURS);
      }
    }
  } catch {
    /* table may not exist; baseline default is fine */
  }
  return map;
}

/**
 * Fetch delivery duration_defaults rows as a Map<sub_type, default_hours>.
 */
export async function fetchDeliveryDurationByType(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("duration_defaults")
      .select("sub_type, default_hours")
      .eq("job_type", "delivery");
    for (const row of data || []) {
      if (row.sub_type) {
        map.set(String(row.sub_type).toLowerCase(), Number(row.default_hours) || DEFAULT_DELIVERY_HOURS);
      }
    }
  } catch {
    /* fine — fall back to default */
  }
  return map;
}
