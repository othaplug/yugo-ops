import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { data: existing } = await db
    .from("project_phases")
    .select("phase_order")
    .eq("project_id", id)
    .order("phase_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.phase_order ?? 0) + 1;

  const { data, error } = await db
    .from("project_phases")
    .insert({
      project_id: id,
      phase_name: body.phase_name,
      description: body.description || null,
      phase_order: body.phase_order ?? nextOrder,
      scheduled_date: body.scheduled_date || null,
      notes: body.notes || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("project_timeline").insert({
    project_id: id,
    event_type: "phase_added",
    event_description: `Phase added: "${body.phase_name}"`,
    phase_id: data.id,
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  if (!body.phase_id) return NextResponse.json({ error: "phase_id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  for (const key of ["phase_name", "description", "phase_order", "status", "scheduled_date", "completed_date", "notes"]) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db.from("project_phases").update(updates).eq("id", body.phase_id).eq("project_id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status === "completed") {
    await db.from("project_timeline").insert({
      project_id: id,
      event_type: "phase_completed",
      event_description: `Phase completed: "${data.phase_name}"`,
      phase_id: data.id,
    });
  }

  return NextResponse.json(data);
}
