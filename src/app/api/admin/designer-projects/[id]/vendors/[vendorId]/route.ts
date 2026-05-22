import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { checkAndAdvanceDesignerPhase } from "@/lib/designer-projects/advance-phase";
import { logActivity } from "@/lib/activity";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: projectId, vendorId } = await params;
  const body = await req.json();
  const db = createAdminClient();

  const allowedFields = [
    "vendor_name",
    "vendor_address",
    "vendor_access",
    "vendor_access_notes",
    "contact_name",
    "contact_phone",
    "contact_email",
    "readiness",
    "readiness_notes",
    "pickup_date",
    "pickup_window",
    "confirmed_at",
    "confirmed_by",
    "received_at",
    "sort_order",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Auto-set confirmed_at when confirming
  if (body.readiness === "confirmed" && !body.confirmed_at) {
    updates.confirmed_at = new Date().toISOString();
  }
  // Auto-set received_at when marking received
  if (body.readiness === "received" && !body.received_at) {
    updates.received_at = new Date().toISOString();
  }

  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data: vendor, error } = await db
    .from("project_vendors")
    .update(updates)
    .eq("id", vendorId)
    .eq("project_id", projectId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.readiness) {
    await logActivity({
      entity_type: "project",
      entity_id: projectId,
      event_type: "vendor_updated",
      description: `${vendor.vendor_name} marked as ${body.readiness}`,
      icon: body.readiness === "confirmed" ? "check" : body.readiness === "delayed" ? "alert" : "pen",
    });
  }

  await checkAndAdvanceDesignerPhase(projectId, db);

  return NextResponse.json({ vendor });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vendorId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: projectId, vendorId } = await params;
  const db = createAdminClient();

  const { data: vendor } = await db
    .from("project_vendors")
    .select("vendor_name")
    .eq("id", vendorId)
    .single();

  const { error } = await db
    .from("project_vendors")
    .delete()
    .eq("id", vendorId)
    .eq("project_id", projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    entity_type: "project",
    entity_id: projectId,
    event_type: "vendor_removed",
    description: `Vendor removed: ${vendor?.vendor_name || vendorId}`,
    icon: "x",
  });

  return NextResponse.json({ ok: true });
}
