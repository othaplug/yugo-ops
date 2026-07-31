/**
 * Single source of truth for "which project day is live right now" on a
 * multi-day move (pack day vs move day vs unpack day).
 *
 * Several surfaces (crew job API, crew job page, client track page) each need
 * to resolve today's active day and read its crew / hours / addresses / stages
 * instead of the move-level single-day values. They used to compute this
 * independently and drifted (pack days rendered move-day crew, budgets, and
 * heroes). Route every one through this helper so they can't fall out of sync.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProjectDayLike = {
  date?: string | null;
  status?: string | null;
  day_type?: string | null;
  day_number?: number | null;
  crew_size?: number | null;
  estimated_hours?: number | null;
};

const norm = (s?: string | null) => (s || "").toLowerCase().replace(/\s+/g, "_");

export const isProjectDayDone = (status?: string | null): boolean => {
  const s = norm(status);
  return s === "completed" || s === "complete";
};

/** Cargo days physically move goods (truck, transit, POD); prep days do not. */
export const isCargoDayType = (dayType?: string | null): boolean => {
  const t = norm(dayType);
  return t === "move" || t === "volume";
};

/**
 * Resolve the active day from a project's day rows.
 * Priority: today's not-yet-complete day → the first non-terminal day →
 * the last day (so a fully-complete project still resolves to something).
 *
 * @param todayKey `YYYY-MM-DD` for "today" in the caller's timezone. Pass the
 *   app-timezone date; callers that only have UTC can pass a UTC slice.
 */
/**
 * The single source of truth for "is this multi-day move still between days?"
 * Returns the subset of `moveIds` that have at least one non-terminal
 * (not completed / not cancelled) move_project_days row — i.e. work remains.
 *
 * Every surface that infers move-completion from a tracking session MUST gate
 * on this, or a completed pack-day session reads as a completed MOVE and the
 * move gets locked / hidden / dropped from the crew's day-2 schedule. A move is
 * complete only when EVERY project day is complete.
 *
 * `db` is any Supabase client (admin or server). Best-effort: on error returns
 * an empty set (fall back to session-only behaviour rather than throw).
 */
export async function moveIdsWithOpenProjectDay(
  db: SupabaseClient,
  moveIds: string[],
): Promise<Set<string>> {
  const open = new Set<string>();
  const ids = [...new Set(moveIds.filter(Boolean))];
  if (ids.length === 0) return open;
  try {
    const { data } = await db
      .from("move_project_days")
      .select("move_id, status")
      .in("move_id", ids);
    for (const row of (data ?? []) as { move_id?: string | null; status?: string | null }[]) {
      if (!row?.move_id) continue;
      const s = norm(row.status);
      if (!["completed", "cancelled"].includes(s)) open.add(String(row.move_id));
    }
  } catch {
    /* best-effort */
  }
  return open;
}

export function resolveActiveProjectDay<T extends ProjectDayLike>(
  days: T[],
  todayKey: string,
): T | null {
  const flat = (Array.isArray(days) ? days : [])
    .filter((d) => d && d.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (flat.length === 0) return null;
  return (
    flat.find(
      (d) => !isProjectDayDone(d.status) && String(d.date || "").slice(0, 10) === todayKey,
    ) ??
    flat.find(
      (d) => !["completed", "cancelled"].includes(norm(d.status)),
    ) ??
    flat[flat.length - 1] ??
    null
  );
}
