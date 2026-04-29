import { timeToMinutes, minutesToTime } from "@/lib/calendar/types";

export type BulkShiftMoveProjectDaysArgs = {
  projectId: string;
  anchorDayId: string;
  targetDate: string;
  /** Omit when only moving calendar dates (untimed days or keep existing times). */
  startTime?: string | null;
  endTime?: string | null;
  crewId?: string | null;
  shiftEntireProject: boolean;
  /** Same calendar date, copy time+crew to every day (day view shift-drag) */
  syncTimeAndCrewToAll: boolean;
};

export async function postBulkShiftMoveProjectDays(
  args: BulkShiftMoveProjectDaysArgs,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {
    anchor_day_id: args.anchorDayId,
    target_date: args.targetDate,
    shift_entire_project: args.shiftEntireProject,
    sync_time_and_crew_to_all: args.syncTimeAndCrewToAll,
  };
  if (args.startTime != null && String(args.startTime).trim() !== "") {
    body.start_time = args.startTime;
  }
  if (args.endTime != null && String(args.endTime).trim() !== "") {
    body.end_time = args.endTime;
  }
  if (args.crewId != null && String(args.crewId).trim() !== "") {
    body.crew_id = args.crewId;
  }

  const res = await fetch(`/api/admin/move-projects/${args.projectId}/bulk-shift-days`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || "Failed to reschedule project days",
    };
  }
  return { ok: true };
}

export function withDurationEnd(start: string, end: string | null, hoursFallback: number | null): string {
  if (end && timeToMinutes(end) > timeToMinutes(start)) return end;
  const add =
    hoursFallback != null && Number.isFinite(hoursFallback)
      ? Math.round(hoursFallback * 60)
      : 120;
  return minutesToTime(Math.min(timeToMinutes(start) + add, 20 * 60 - 15));
}
