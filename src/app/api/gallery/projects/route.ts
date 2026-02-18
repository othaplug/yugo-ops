import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

const PROJECT_TYPE_VALUES = ["exhibition", "delivery", "install", "storage_retrieval", "art_fair", "other"] as const;

export async function GET() {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const supabase = await createClient();
    const { data: projects, error } = await supabase
      .from("gallery_projects")
      .select("id, name, gallery, gallery_org_id, details, status, address, project_type, white_glove, crating_required, climate_controlled, insurance_value, install_deinstall_notes, location, start_date, end_date, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(projects ?? []);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const {
      name,
      gallery,
      gallery_org_id,
      details,
      address,
      project_type,
      white_glove,
      crating_required,
      climate_controlled,
      insurance_value,
      install_deinstall_notes,
      location,
      start_date,
      end_date,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const row: Record<string, unknown> = {
      name: name.trim(),
      gallery: (gallery || "").trim() || null,
      details: (details || "").trim() || null,
      status: "new",
      updated_at: new Date().toISOString(),
    };
    if (gallery_org_id && typeof gallery_org_id === "string") row.gallery_org_id = gallery_org_id;
    if (address != null && typeof address === "string") row.address = address.trim() || null;
    if (project_type && PROJECT_TYPE_VALUES.includes(project_type)) row.project_type = project_type;
    if (typeof white_glove === "boolean") row.white_glove = white_glove;
    if (typeof crating_required === "boolean") row.crating_required = crating_required;
    if (typeof climate_controlled === "boolean") row.climate_controlled = climate_controlled;
    if (insurance_value != null && typeof insurance_value === "string") row.insurance_value = insurance_value.trim() || null;
    if (install_deinstall_notes != null && typeof install_deinstall_notes === "string") row.install_deinstall_notes = install_deinstall_notes.trim() || null;
    if (location != null && typeof location === "string") row.location = location.trim() || null;
    if (start_date) row.start_date = start_date;
    if (end_date) row.end_date = end_date;

    const { data, error } = await supabase.from("gallery_projects").insert(row).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create project" },
      { status: 500 }
    );
  }
}
