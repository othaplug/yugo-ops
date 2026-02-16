import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

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
    const { data, error } = await supabase
      .from("gallery_projects")
      .insert({
        name: name.trim(),
        gallery: (gallery || "").trim() || null,
        details: (details || "").trim() || null,
        status: "new",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create project" },
      { status: 500 }
    );
  }
}
