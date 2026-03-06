import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { orgIds, userId, error } = await requirePartner();
  if (error) return error;

  const db = createAdminClient();

  // Verify partner owns project
  const { data: project } = await db.from("projects").select("id").eq("id", id).in("partner_id", orgIds).single();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  const allowedTypes = ["note_added", "issue_flagged", "phase_approved"];
  const eventType = allowedTypes.includes(body.event_type) ? body.event_type : "note_added";

  const { data, error: dbErr } = await db
    .from("project_timeline")
    .insert({
      project_id: id,
      event_type: eventType,
      event_description: body.event_description,
      phase_id: body.phase_id || null,
      user_id: userId,
      photos: body.photos || null,
    })
    .select()
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
