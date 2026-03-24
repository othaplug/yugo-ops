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
