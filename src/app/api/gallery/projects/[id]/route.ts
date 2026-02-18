import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

const PROJECT_TYPE_VALUES = ["exhibition", "delivery", "install", "storage_retrieval", "art_fair", "other"] as const;
const STATUS_VALUES = ["new", "staging", "scheduled", "in_transit", "delivered"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const body = await req.json();

    const supabase = await createClient();
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name != null && typeof body.name === "string") row.name = body.name.trim();
    if (body.gallery !== undefined) row.gallery = typeof body.gallery === "string" ? body.gallery.trim() || null : null;
    if (body.gallery_org_id !== undefined) row.gallery_org_id = body.gallery_org_id || null;
    if (body.details != null) row.details = typeof body.details === "string" ? body.details.trim() || null : null;
    if (body.status && STATUS_VALUES.includes(body.status)) row.status = body.status;
    if (body.address != null) row.address = typeof body.address === "string" ? body.address.trim() || null : null;
    if (body.project_type && PROJECT_TYPE_VALUES.includes(body.project_type)) row.project_type = body.project_type;
    if (typeof body.white_glove === "boolean") row.white_glove = body.white_glove;
    if (typeof body.crating_required === "boolean") row.crating_required = body.crating_required;
    if (typeof body.climate_controlled === "boolean") row.climate_controlled = body.climate_controlled;
    if (body.insurance_value != null) row.insurance_value = typeof body.insurance_value === "string" ? body.insurance_value.trim() || null : null;
    if (body.install_deinstall_notes != null) row.install_deinstall_notes = typeof body.install_deinstall_notes === "string" ? body.install_deinstall_notes.trim() || null : null;
    if (body.location != null) row.location = typeof body.location === "string" ? body.location.trim() || null : null;
    if (body.start_date != null) row.start_date = body.start_date || null;
    if (body.end_date != null) row.end_date = body.end_date || null;

    const { data, error } = await supabase
      .from("gallery_projects")
      .update(row)
      .eq("id", id)
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update project" },
      { status: 500 }
    );
  }
}
