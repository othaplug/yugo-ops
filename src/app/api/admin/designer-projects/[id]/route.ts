import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { checkAndAdvanceDesignerPhase } from "@/lib/designer-projects/advance-phase";
import { logActivity } from "@/lib/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const db = createAdminClient();

  const { data: project, error } = await db
    .from("projects")
    .select(
      `
      *,
      organizations:partner_id(id, name, type, email, contact_email),
      project_vendors(* ),
      project_inventory(*),
      project_timeline(id, event_type, event_description, created_at)
    `,
    )
    .eq("id", id)
    .not("designer_phase", "is", null)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Sort vendors by sort_order, timeline by created_at desc
  if (project.project_vendors) {
    project.project_vendors.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    );
  }
  if (project.project_timeline) {
    project.project_timeline.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  // If a delivery job is linked, fetch its number
  let deliveryJob = null;
  if (project.delivery_job_id) {
    const { data: dj } = await db
      .from("deliveries")
      .select("id, delivery_number, status, delivery_date")
      .eq("id", project.delivery_job_id)
      .single();
    deliveryJob = dj;
  }

  return NextResponse.json({ project: { ...project, deliveryJob } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const db = createAdminClient();

  const allowedFields = [
    "project_name",
    "end_client_name",
    "end_client_contact",
    "site_address",
    "install_unit",
    "install_floor",
    "install_access",
    "install_access_notes",
    "rooms",
    "placement_spec_url",
    "designer_phase",
    "target_end_date",
    "estimated_budget",
    "coordinator_id",
    "coordinator_name",
    "hubspot_deal_id",
    "notes",
    "status",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data: project, error } = await db
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log significant field changes
  if (body.designer_phase) {
    await logActivity({
      entity_type: "project",
      entity_id: id,
      event_type: "phase_changed",
      description: `Phase manually set to: ${String(body.designer_phase).replace(/_/g, " ")}`,
      icon: "pen",
    });
  }

  // Re-check auto-advancement after any update
  await checkAndAdvanceDesignerPhase(id, db);

  return NextResponse.json({ project });
}
