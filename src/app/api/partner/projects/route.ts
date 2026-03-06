import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: projects, error: dbErr } = await db
    .from("projects")
    .select(`
      id, project_number, project_name, description,
      end_client_name, site_address, status, active_phase,
      start_date, target_end_date, estimated_budget,
      created_at
    `)
    .in("partner_id", orgIds)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  // Fetch phases and inventory counts for each project
  const projectIds = (projects || []).map((p) => p.id);
  if (projectIds.length === 0) return NextResponse.json([]);

  const [{ data: phases }, { data: inventory }, { data: deliveries }] = await Promise.all([
    db.from("project_phases").select("id, project_id, phase_name, phase_order, status, scheduled_date, completed_date").in("project_id", projectIds).order("phase_order"),
    db.from("project_inventory").select("id, project_id, status").in("project_id", projectIds),
    db.from("deliveries").select("id, project_id, status, scheduled_date").in("project_id", projectIds).order("scheduled_date"),
  ]);

  const result = (projects || []).map((p) => {
    const pPhases = (phases || []).filter((ph) => ph.project_id === p.id);
    const pItems = (inventory || []).filter((i) => i.project_id === p.id);
    const pDeliveries = (deliveries || []).filter((d) => d.project_id === p.id);
    const receivedItems = pItems.filter((i) => !["expected"].includes(i.status)).length;
    const completedPhases = pPhases.filter((ph) => ph.status === "completed").length;
    const nextDelivery = pDeliveries.find((d) => d.status !== "completed" && d.status !== "delivered" && d.status !== "cancelled");

    return {
      ...p,
      phases: pPhases,
      itemsTotal: pItems.length,
      itemsReceived: receivedItems,
      phasesTotal: pPhases.length,
      phasesCompleted: completedPhases,
      nextDeliveryDate: nextDelivery?.scheduled_date || null,
    };
  });

  return NextResponse.json(result);
}
