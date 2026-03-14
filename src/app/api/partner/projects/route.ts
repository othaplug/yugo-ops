import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { notifyAllAdmins } from "@/lib/notifications";

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

/** POST /api/partner/projects — Create a new project (partner self-service) */
export async function POST(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) return NextResponse.json({ error: "No organization" }, { status: 403 });

  const db = createAdminClient();

  // Fetch org name for notification
  const { data: org } = await db.from("organizations").select("name").eq("id", orgIds[0]).single();
  const orgName = org?.name || "a partner";
  const body = await req.json();

  const {
    project_name, description,
    client_name, client_address, client_phone, client_email,
    start_date, end_date, budget_range,
    phases: selectedPhases,
  } = body;

  if (!project_name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  // Insert project
  const { data: project, error: insertErr } = await db
    .from("projects")
    .insert({
      partner_id: orgIds[0],
      project_name: project_name.trim(),
      description: description?.trim() || null,
      end_client_name: client_name?.trim() || null,
      end_client_contact: [client_phone, client_email].filter(Boolean).join(" | ") || null,
      site_address: client_address?.trim() || null,
      start_date: start_date || null,
      target_end_date: end_date || null,
      estimated_budget: budget_range || null,
      status: "draft",
    })
    .select("id, project_number, project_name")
    .single();

  if (insertErr || !project) {
    return NextResponse.json({ error: insertErr?.message || "Failed to create project" }, { status: 500 });
  }

  // Insert selected phases
  const PHASE_MAP: Record<string, { name: string; order: number }> = {
    receiving:    { name: "Receiving",    order: 1 },
    storage:      { name: "Storage",      order: 2 },
    delivery:     { name: "Delivery",     order: 3 },
    installation: { name: "Installation", order: 4 },
    removal:      { name: "Removal",      order: 5 },
  };

  if (Array.isArray(selectedPhases) && selectedPhases.length > 0) {
    const phaseRows = selectedPhases
      .filter((k) => PHASE_MAP[k])
      .map((k) => ({
        project_id: project.id,
        phase_name: PHASE_MAP[k].name,
        phase_order: PHASE_MAP[k].order,
        status: "pending",
      }));
    if (phaseRows.length > 0) {
      await db.from("project_phases").insert(phaseRows);
    }
  }

  // Notify all admins
  await notifyAllAdmins({
    title: `New project created by ${orgName || "a partner"}`,
    body: `${project_name}${client_name ? ` for ${client_name}` : ""}`,
    icon: "projects",
    link: `/admin/projects/${project.id}`,
    sourceType: "project",
    sourceId: project.id,
    eventSlug: "partner_project_created",
  });

  return NextResponse.json(project, { status: 201 });
}
