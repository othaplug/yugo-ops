import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { checkAndAdvanceDesignerPhase } from "@/lib/designer-projects/advance-phase";
import { logActivity } from "@/lib/activity";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: projectId } = await params;
  const body = await req.json();
  const db = createAdminClient();

  // Validate project exists and is a designer project
  const { data: project } = await db
    .from("projects")
    .select("id, project_name")
    .eq("id", projectId)
    .not("designer_phase", "is", null)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Get next sort_order
  const { data: existingVendors } = await db
    .from("project_vendors")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existingVendors?.length ? (existingVendors[0].sort_order + 1) : 0;

  const { data: vendor, error } = await db
    .from("project_vendors")
    .insert({
      project_id: projectId,
      vendor_name: body.vendor_name || "New Vendor",
      vendor_address: body.vendor_address || null,
      vendor_access: body.vendor_access || "ground_floor",
      vendor_access_notes: body.vendor_access_notes || null,
      contact_name: body.contact_name || null,
      contact_phone: body.contact_phone || null,
      contact_email: body.contact_email || null,
      readiness: "pending",
      readiness_notes: body.readiness_notes || null,
      pickup_date: body.pickup_date || null,
      pickup_window: body.pickup_window || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    entity_type: "project",
    entity_id: projectId,
    event_type: "vendor_added",
    description: `Vendor added: ${vendor.vendor_name}`,
    icon: "partner",
  });

  // Adding first vendor advances planning → vendor_coordination
  await checkAndAdvanceDesignerPhase(projectId, db);

  return NextResponse.json({ vendor }, { status: 201 });
}
