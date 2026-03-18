import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/**
 * DELETE /api/partner/projects/[id]/inventory/[itemId]
 * Remove an inventory item from the project.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: projectId, itemId } = await params;
  const { orgIds, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  const { data: project } = await db
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .in("partner_id", orgIds)
    .single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: existing, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .single();
  if (fetchErr || !existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const { error: deleteErr } = await db
    .from("project_inventory")
    .delete()
    .eq("id", itemId)
    .eq("project_id", projectId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  await db.from("project_timeline").insert({
    project_id: projectId,
    event_type: "item_removed",
    event_description: `${existing.item_name} removed`,
  });

  return NextResponse.json({ ok: true });
}
