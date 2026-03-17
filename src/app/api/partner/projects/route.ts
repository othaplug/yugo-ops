import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { notifyAllAdmins } from "@/lib/notifications";

const RECEIVED_STATUSES = [
  "received_warehouse",
  "inspected",
  "stored",
  "scheduled_delivery",
  "delivered",
  "installed",
];

const TRANSIT_STATUSES = ["shipped", "in_transit"];

export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: projects, error: dbErr } = await db
    .from("projects")
    .select(
      `id, project_number, project_name, description,
       end_client_name, site_address, status, active_phase,
       start_date, target_end_date, estimated_budget, created_at`
    )
    .in("partner_id", orgIds)
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const projectIds = (projects || []).map((p) => p.id);
  if (projectIds.length === 0) return NextResponse.json([]);

  const [{ data: inventory }, { data: deliveries }] = await Promise.all([
    db
      .from("project_inventory")
      .select("id, project_id, item_status, status")
      .in("project_id", projectIds),
    db
      .from("deliveries")
      .select("id, project_id, status, scheduled_date")
      .in("project_id", projectIds)
      .order("scheduled_date"),
  ]);

  const result = (projects || []).map((p) => {
    const pItems = (inventory || []).filter((i) => i.project_id === p.id);
    const pDeliveries = (deliveries || []).filter((d) => d.project_id === p.id);

    // Use item_status if present, fall back to legacy status mapping
    const getItemStatus = (item: { item_status: string | null; status: string }) =>
      item.item_status || item.status || "ordered";

    const itemsReceived = pItems.filter((i) =>
      RECEIVED_STATUSES.includes(getItemStatus(i))
    ).length;
    const itemsInTransit = pItems.filter((i) =>
      TRANSIT_STATUSES.includes(getItemStatus(i))
    ).length;
    const itemsIssue = pItems.filter((i) => getItemStatus(i) === "issue_reported").length;

    const nextDelivery = pDeliveries.find(
      (d) =>
        d.status !== "completed" && d.status !== "delivered" && d.status !== "cancelled"
    );

    return {
      ...p,
      itemsTotal: pItems.length,
      itemsReceived,
      itemsInTransit,
      itemsIssue,
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

  const { data: org } = await db
    .from("organizations")
    .select("name")
    .eq("id", orgIds[0])
    .single();
  const orgName = org?.name || "a partner";
  const body = await req.json();

  const { project_name, client_name, client_address, end_date } = body;

  if (!project_name?.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }

  const { data: project, error: insertErr } = await db
    .from("projects")
    .insert({
      partner_id: orgIds[0],
      project_name: project_name.trim(),
      end_client_name: client_name?.trim() || null,
      site_address: client_address?.trim() || null,
      target_end_date: end_date || null,
      status: "active",
    })
    .select("id, project_number, project_name")
    .single();

  if (insertErr || !project) {
    return NextResponse.json({ error: insertErr?.message || "Failed to create project" }, { status: 500 });
  }

  // Initial timeline entry
  await db.from("project_timeline").insert({
    project_id: project.id,
    event_type: "project_created",
    event_description: `Project created: ${project_name}`,
  });

  await notifyAllAdmins({
    title: `New project by ${orgName}`,
    body: `${project_name}${client_name ? ` for ${client_name}` : ""}`,
    icon: "projects",
    link: `/admin/projects/${project.id}`,
    sourceType: "project",
    sourceId: project.id,
    eventSlug: "partner_project_created",
  });

  return NextResponse.json(project, { status: 201 });
}
