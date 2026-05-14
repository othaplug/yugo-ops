/**
 * Single source of truth for "how many movers are on this specific move".
 *
 * The bug we're avoiding: `crews.members` is the entire ROSTER of a crew pool
 * (e.g. Alpha crew has 4 movers on staff). Pulling `crews.members.length` for
 * a per-move crew size is wrong — only a subset of that roster is actually
 * assigned to any given move. The text message for MV-30211 went out saying
 * "crew of 4" because the SMS template was reading `crews.members.length`,
 * while the admin UI correctly read `moves.assigned_members.length` (= 2).
 *
 * Priority (most authoritative first):
 *   1. moves.assigned_members         — explicitly chosen movers for THIS move
 *   2. moves.crew_size                — coordinator override at the move level
 *   3. moves.est_crew_size            — engine plan from the quote
 *
 * Note we intentionally do NOT fall through to `crews.members.length` — that
 * would re-introduce the original bug.
 */

export type MoveCrewSizeInput = {
  assigned_members?: string[] | null;
  crew_size?: number | null;
  est_crew_size?: number | null;
};

export function getMoveCrewSize(move: MoveCrewSizeInput): number | null {
  const assigned = Array.isArray(move.assigned_members)
    ? move.assigned_members.filter((s) => typeof s === "string" && s.trim().length > 0)
    : [];
  if (assigned.length > 0) return assigned.length;

  const cs = Number(move.crew_size ?? NaN);
  if (Number.isFinite(cs) && cs > 0) return Math.round(cs);

  const ecs = Number(move.est_crew_size ?? NaN);
  if (Number.isFinite(ecs) && ecs > 0) return Math.round(ecs);

  return null;
}
