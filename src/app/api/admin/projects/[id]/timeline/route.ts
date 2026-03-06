import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data, error } = await db
    .from("project_timeline")
    .insert({
      project_id: id,
      event_type: body.event_type || "note_added",
      event_description: body.event_description,
      phase_id: body.phase_id || null,
      user_id: body.user_id || null,
      photos: body.photos || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
