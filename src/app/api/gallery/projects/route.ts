import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

// Schema only has the core columns; the richer gallery-project fields
// (project_type, white_glove, dates, location, insurance value, etc.) were
// designed but never migrated. Keep the route lean against the real columns
// so the list page works; expand once the migration ships.

export async function GET() {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const supabase = await createClient();
    const { data: projects, error } = await supabase
      .from("gallery_projects")
      .select("id, name, gallery, details, status, requires_condition_report, created_at, updated_at")
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
    const { name, gallery, details } = body;

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
