/**
 * Pick the right member subset to display for a crew on the live-
 * tracking map / dispatch panel.
 *
 * Source of truth for "who is actually on this job" is the move's
 * `assigned_members` snapshot (or delivery's), NOT the team roster.
 * Alpha may have five movers on staff but only Gary + Che assigned to
 * MV-30228 — the operator should see Gary, Che only while the job is
 * live, otherwise dispatch (and the client portal that mirrors this)
 * implies a five-person crew when it's actually two.
 *
 * Behavior:
 *   - No active session for the team → return the full roster (idle
 *     teams show every mover so dispatch knows who's available).
 *   - Active session but its job has no `assigned_members` snapshot
 *     (legacy rows from before the snapshot column existed) → fall
 *     back to the full roster.
 *   - Active session whose job has an array snapshot (even empty) →
 *     return the snapshot. Empty array intentionally means "no one
 *     listed" and the client renders the team name only.
 *
 * This used to live inline in src/app/api/tracking/crews-map/route.ts.
 * Extracted so the SSE stream (src/app/api/tracking/stream/all) can
 * compute the same subset — previously the SSE payload omitted
 * members entirely, so the moment a move started after the live-
 * tracking page had loaded, the on-screen member list was frozen at
 * the full-roster snapshot from initial load (Oche flagged
 * 2026-06-29: "John, Gary, Che, Belah, Connor" still showing while
 * MV-30228 was in progress with only Gary + Che assigned).
 */

export type JobRowWithAssigned = {
  id: string;
  assigned_members?: unknown;
};

export function displayMembersForCrew(
  fullMembers: string[],
  session: { job_id: string; job_type: string } | undefined,
  moves: JobRowWithAssigned[],
  deliveries: JobRowWithAssigned[],
): string[] {
  if (!session?.job_id) return fullMembers;
  const job =
    session.job_type === "move"
      ? moves.find((m) => m.id === session.job_id)
      : deliveries.find((d) => d.id === session.job_id);
  if (!job) return fullMembers;
  const raw = job.assigned_members;
  if (raw == null) return fullMembers;
  if (!Array.isArray(raw)) return fullMembers;
  return raw.filter(
    (n): n is string => typeof n === "string" && n.trim().length > 0,
  );
}
