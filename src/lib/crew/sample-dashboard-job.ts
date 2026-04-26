/**
 * synthetic row for the crew dashboard so designers and devs can see layout with no DB move.
 * Never opens a real job: id is a sentinel; UI shows "Sample" and blocks navigation.
 */
export const CREW_SAMPLE_MOVE_JOB_ID = "__yugo_crew_sample_move__";

export function isCrewSampleDashboardJobId(id: string): boolean {
  return id === CREW_SAMPLE_MOVE_JOB_ID;
}

/**
 * In development, the sample is on by default. Set `CREW_DASHBOARD_SAMPLE_MOVE=0` to hide.
 * In production, set `CREW_DASHBOARD_SAMPLE_MOVE=1` to show (e.g. staging).
 */
export function shouldIncludeCrewDashboardSampleMove(): boolean {
  const v = (process.env.CREW_DASHBOARD_SAMPLE_MOVE || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return process.env.NODE_ENV === "development";
}

export function buildCrewSampleDashboardMoveJob() {
  return {
    id: CREW_SAMPLE_MOVE_JOB_ID,
    jobId: "MV-SAMPLE",
    jobType: "move" as const,
    clientName: "Sample (preview)",
    fromAddress: "100 Queen St W, Toronto, ON",
    toAddress: "25 British Columbia Rd, Toronto, ON",
    jobTypeLabel: "Residential",
    itemCount: 24,
    scheduledTime: "8:00 AM",
    status: "scheduled",
    completedAt: null as string | null,
    isRecurring: false,
    bookingType: null as string | null,
    eventPhase: null as string | null,
    eventName: null as string | null,
    weatherBrief: null,
    weatherAlert: null,
    fromAccessLine: "Elevator",
    toAccessLine: "Elevator",
  };
}
