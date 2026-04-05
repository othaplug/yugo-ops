import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchMoveProjectWithTree(db: SupabaseClient, projectId: string) {
  const { data: project, error: pErr } = await db.from("move_projects").select("*").eq("id", projectId).maybeSingle();
  if (pErr || !project) return { project: null, error: pErr?.message ?? "Not found" };

  const { data: phases, error: phErr } = await db
    .from("move_project_phases")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("phase_number", { ascending: true });

  if (phErr) return { project: null, error: phErr.message };

  const phaseList = phases ?? [];
  const phaseIds = phaseList.map((p) => p.id as string);
  let days: Record<string, unknown>[] = [];
  if (phaseIds.length > 0) {
    const { data: dayRows, error: dErr } = await db
      .from("move_project_days")
      .select("*")
      .in("phase_id", phaseIds)
      .order("date", { ascending: true })
      .order("day_number", { ascending: true });
    if (dErr) return { project: null, error: dErr.message };
    days = dayRows ?? [];
  }

  const daysByPhase = new Map<string, typeof days>();
  for (const d of days) {
    const pid = d.phase_id as string;
    if (!daysByPhase.has(pid)) daysByPhase.set(pid, []);
    daysByPhase.get(pid)!.push(d);
  }

  return {
    project,
    phases: phaseList.map((ph) => ({
      ...ph,
      days: daysByPhase.get(ph.id as string) ?? [],
    })),
    error: null as string | null,
  };
}
