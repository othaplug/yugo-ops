import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** List renovation projects (and units) for the partner org. */
export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("renovation_projects")
    .select("id, project_name, total_units, start_date, end_date, status, property_id")
    .eq("partner_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const projectIds = (projects ?? []).map((p) => p.id);
  let units: Record<string, unknown[]> = {};
  if (projectIds.length) {
    const { data: unitRows } = await admin.from("renovation_units").select("*").in("project_id", projectIds);
    for (const u of unitRows ?? []) {
      const pid = u.project_id as string;
      if (!units[pid]) units[pid] = [];
      units[pid]!.push(u);
    }
  }

  return NextResponse.json({
    projects: (projects ?? []).map((p) => ({
      ...p,
      units: units[p.id as string] ?? [],
    })),
  });
}
