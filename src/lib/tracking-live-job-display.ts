import { normalizeDeliveryStatus } from "@/lib/crew-tracking-status";

/** Session-level statuses where we must not show a job code on the live map. */
const SESSION_NO_JOB_CODE = new Set([
  "completed",
  "cancelled",
  "delivered",
  "done",
  "not_started",
  "idle",
]);

/**
 * True when tracking session status alone warrants showing a job code (before checking move/delivery row).
 */
export function sessionStatusAllowsJobCode(sessionStatus: string | null | undefined): boolean {
  const normalized = normalizeDeliveryStatus((sessionStatus || "").toLowerCase());
  if (!normalized || SESSION_NO_JOB_CODE.has(normalized)) return false;
  return true;
}

/**
 * Crew tapped "Start" in the app (`/api/tracking/start` sets delivery to in_progress).
 * Scheduled/confirmed-only assignments must not show a job ID on the map.
 */
export function isDeliveryRowLiveForMap(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return ["in_progress", "dispatched", "in_transit", "en_route"].includes(s);
}

/** Same idea for moves: only after start does the move row become in_progress. */
export function isMoveRowLiveForMap(status: string | null | undefined): boolean {
  return (status || "").toLowerCase() === "in_progress";
}
