import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

function mapUnitUiStatus(db: string): "pending" | "scheduled" | "in_progress" | "completed" {
  const s = String(db || "").toLowerCase();
  if (s === "complete" || s === "return_complete") return "completed";
  if (s === "outbound_scheduled" || s === "return_scheduled") return "scheduled";
  if (s === "outbound_complete" || s === "in_progress") return "in_progress";
  return "pending";
}

/** PM programs (optional) for booking + tracker. */
export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("pm_projects")
    .select("id, project_name, project_type, total_units, start_date, end_date, status, property_id")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const projectIds = (projects ?? []).map((p) => p.id as string);
  const unitCountByProject: Record<string, number> = {};
  const unitsByProject = new Map<
    string,
    { number: string; status: "pending" | "scheduled" | "in_progress" | "completed" }[]
  >();

  if (projectIds.length) {
    const { data: unitRows } = await admin
      .from("pm_project_units")
      .select("project_id, unit_number, status, outbound_date, return_date")
      .in("project_id", projectIds);

    for (const row of unitRows ?? []) {
      const pid = row.project_id as string;
      unitCountByProject[pid] = (unitCountByProject[pid] ?? 0) + 1;
      const list = unitsByProject.get(pid) ?? [];
      list.push({
        number: String(row.unit_number || ""),
        status: mapUnitUiStatus(row.status as string),
      });
      unitsByProject.set(pid, list);
    }
  }

  const propIds = [...new Set((projects ?? []).map((p) => p.property_id).filter(Boolean))] as string[];
  const propNames: Record<string, string> = {};
  if (propIds.length) {
    const { data: props } = await admin.from("partner_properties").select("id, building_name").in("id", propIds);
    for (const pr of props ?? []) propNames[pr.id as string] = pr.building_name as string;
  }

  let moveRows: {
    id: string;
    pm_project_id: string | null;
    scheduled_date: string | null;
    unit_number: string | null;
    status: string | null;
  }[] = [];
  if (projectIds.length) {
    const { data: mr } = await admin
      .from("moves")
      .select("id, pm_project_id, scheduled_date, unit_number, status")
      .eq("organization_id", orgId)
      .in("pm_project_id", projectIds);
    moveRows = mr ?? [];
  }

  const movesByProject = new Map<string, typeof moveRows>();
  for (const m of moveRows) {
    const pid = m.pm_project_id as string;
    if (!movesByProject.has(pid)) movesByProject.set(pid, []);
    movesByProject.get(pid)!.push(m);
  }

  const enriched = (projects ?? []).map((p) => {
    const pid = p.id as string;
    const units = unitsByProject.get(pid) ?? [];
    const moves = (movesByProject.get(pid) ?? []).filter(Boolean);
    const terminal = new Set(["completed", "paid", "delivered"]);
    const completedMoves = moves.filter((m) => terminal.has(String(m.status || "").toLowerCase())).length;
    const open = moves
      .filter((m) => !terminal.has(String(m.status || "").toLowerCase()))
      .sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)));
    const next = open[0];
    const propId = p.property_id as string | null;

    return {
      ...p,
      tracked_units: unitCountByProject[pid] ?? 0,
      building_name: propId ? propNames[propId] ?? null : null,
      units,
      completed_moves: completedMoves,
      total_moves: Math.max(moves.length, units.length > 0 ? units.length * 2 : 1, 1),
      next_move: next
        ? { unit: next.unit_number as string | null, date: next.scheduled_date as string | null }
        : null,
    };
  });

  return NextResponse.json({ projects: enriched });
}
