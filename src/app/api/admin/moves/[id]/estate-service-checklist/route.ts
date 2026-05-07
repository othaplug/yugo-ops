import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEstateServiceChecklistItem } from "@/lib/estate-service-checklist";

/** Staff/coordinator: set an Estate milestone checkbox on the client track checklist. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const { item, checked } = await req.json();

  if (!item) {
    return NextResponse.json({ error: "item required" }, { status: 400 });
  }
  if (!isAllowedEstateServiceChecklistItem(String(item))) {
    return NextResponse.json({ error: "Invalid checklist item" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: move, error: fetchErr } = await admin
    .from("moves")
    .select("id, estate_service_checklist")
    .eq("id", moveId)
    .single();

  if (fetchErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const current =
    (move.estate_service_checklist as Record<string, boolean>) || {};
  const updated = { ...current, [String(item)]: Boolean(checked) };

  const { error: updErr } = await admin
    .from("moves")
    .update({ estate_service_checklist: updated })
    .eq("id", moveId);

  if (updErr) {
    return NextResponse.json(
      { error: updErr.message || "Update failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, checklist: updated });
}
