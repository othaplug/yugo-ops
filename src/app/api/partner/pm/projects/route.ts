import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

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

  const projectIds = (projects ?? []).map((p) => p.id);
  const unitCountByProject: Record<string, number> = {};
  if (projectIds.length) {
    const { data: counts } = await admin.from("pm_project_units").select("project_id").in("project_id", projectIds);
    for (const row of counts ?? []) {
      const pid = row.project_id as string;
      unitCountByProject[pid] = (unitCountByProject[pid] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    projects: (projects ?? []).map((p) => ({
      ...p,
      tracked_units: unitCountByProject[p.id as string] ?? 0,
    })),
  });
}
