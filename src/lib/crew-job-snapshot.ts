import type { SupabaseClient } from "@supabase/supabase-js";

export type CrewAssignmentSnapshot = {
  assigned_members: string[];
  assigned_crew_name: string | null;
};

const EMPTY: CrewAssignmentSnapshot = { assigned_members: [], assigned_crew_name: null };

/** Snapshot current crew roster + label for persisting on moves/deliveries. */
export async function fetchCrewAssignmentSnapshot(
  admin: SupabaseClient,
  crewId: string | null | undefined,
): Promise<CrewAssignmentSnapshot> {
  const id = typeof crewId === "string" ? crewId.trim() : "";
  if (!id) return { ...EMPTY };

  const { data } = await admin.from("crews").select("name, members").eq("id", id).maybeSingle();
  const raw = data?.members;
  const assigned_members = Array.isArray(raw)
    ? raw.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
    : [];
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  return {
    assigned_members,
    assigned_crew_name: name || null,
  };
}

/**
 * Resolve which members to persist when a crew is set/re-set WITHOUT an explicit
 * member list. The long-standing bug: assigning, re-scheduling, or bulk-assigning
 * a crew snapshotted the full roster every time, wiping a coordinator's chosen
 * subset (e.g. 2 of "Alpha"'s 4 movers) right back to the full team.
 *
 * Rule: when the crew has NOT changed, preserve whatever explicit subset is
 * already on the job. Only snapshot the full roster on a genuinely new crew (or
 * a first assignment). This keeps subset selections sticky across reschedules,
 * recommended-crew clicks, and calendar moves.
 */
export function resolveAssignedMembers(args: {
  previousCrewId: string | null | undefined;
  nextCrewId: string | null | undefined;
  existingMembers: unknown;
  snapshotMembers: string[];
}): string[] {
  const prev = typeof args.previousCrewId === "string" ? args.previousCrewId.trim() : "";
  const next = typeof args.nextCrewId === "string" ? args.nextCrewId.trim() : "";
  const existing = Array.isArray(args.existingMembers)
    ? args.existingMembers.filter(
        (m): m is string => typeof m === "string" && m.trim().length > 0,
      )
    : [];
  // Same crew + an explicit subset already chosen → keep the subset.
  if (next && next === prev && existing.length > 0) return existing;
  // New crew or no prior subset → snapshot the full roster.
  return args.snapshotMembers;
}
