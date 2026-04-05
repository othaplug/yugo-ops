import { parseDateOnly } from "@/lib/date-format";

/** Names unlock from this many calendar days before scheduled date through move day and beyond (until completed / in progress always). */
export const CREW_NAME_REVEAL_DAYS_BEFORE_MOVE = 3;

export type MoveTrackCrewRevealInput = {
  /** True when a crew is on the job (see {@link isCrewAssignedOnMove}). */
  crewAssigned: boolean;
  scheduledDate: string | null | undefined;
  isInProgress: boolean;
  isCompleted: boolean;
};

/**
 * Whether the client may see assigned crew **names** on the track page.
 * Requires a crew on the job. Names unlock in the **3 days before move day
 * through move day** (calendar math, same as `daysUntil <= 3`), and any time
 * the job is **in progress** or **completed**.
 */
export function shouldRevealCrewNamesOnMoveTrack(
  input: MoveTrackCrewRevealInput,
): boolean {
  if (!input.crewAssigned) return false;
  if (input.isCompleted || input.isInProgress) return true;
  const d = input.scheduledDate
    ? (parseDateOnly(input.scheduledDate) ?? null)
    : null;
  if (!d) return false;
  const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return daysUntil <= CREW_NAME_REVEAL_DAYS_BEFORE_MOVE;
}

/** Admin has put a team on the move (crew record and/or named members on the row). */
export function isCrewAssignedOnMove(move: {
  crew_id?: string | null;
  assigned_members?: unknown;
}): boolean {
  if (move.crew_id) return true;
  if (!Array.isArray(move.assigned_members)) return false;
  return move.assigned_members.some(
    (n) => String(n ?? "").trim().length > 0,
  );
}
