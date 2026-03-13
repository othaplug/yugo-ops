import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** PATCH: Update VENDOR/CARRIER inventory items (partners cannot change Yugo items) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  // Verify partner owns project
  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (!body.item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  // Fetch item to verify it's VENDOR/CARRIER
  const { data: item, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name, phase_id, handled_by")
    .eq("id", body.item_id)
    .eq("project_id", projectId)
    .single();

  if (fetchErr || !item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  const handledBy = item.handled_by || "yugo";
  if (handledBy === "yugo") {
    return NextResponse.json({ error: "Cannot update Yugo-handled items" }, { status: 403 });
  }

  const allowedKeys = ["status", "vendor_tracking_number", "vendor_carrier", "expected_delivery_date", "inspection_notes", "received_date", "delivered_date"];
  const updates: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error: updateErr } = await db
    .from("project_inventory")
    .update(updates)
    .eq("id", body.item_id)
    .eq("project_id", projectId)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Timeline entry for status changes
  if (body.status === "received") {
    await db.from("project_timeline").insert({
      project_id: projectId,
      event_type: "item_received",
      event_description: `${data.item_name} — received`,
      phase_id: data.phase_id,
    });
  }
  if (body.status === "delivered") {
    await db.from("project_timeline").insert({
      project_id: projectId,
      event_type: "item_delivered",
      event_description: `${data.item_name} — delivered`,
      phase_id: data.phase_id,
    });
  }

  return NextResponse.json(data);
}
