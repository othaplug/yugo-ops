import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { moveProjectPayloadSchema } from "@/lib/move-projects/schema";
import { replaceMoveProjectTree } from "@/lib/move-projects/persist";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  const { project, phases, error } = await fetchMoveProjectWithTree(db, id);
  if (error || !project) return NextResponse.json({ error: error || "Not found" }, { status: 404 });
  return NextResponse.json({ ...project, phases });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.phases && Array.isArray(body.phases)) {
    const parsed = moveProjectPayloadSchema.safeParse({
      ...body,
      project_name: (body.project_name as string) || "Project",
      start_date: body.start_date || new Date().toISOString().slice(0, 10),
      phases: body.phases,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    }
    const payload = parsed.data;
    const totalDays =
      payload.total_days && payload.total_days > 0
        ? payload.total_days
        : Math.max(1, payload.phases.reduce((acc, ph) => acc + ph.days.length, 0));
    let endDate = payload.end_date ?? null;
    if (!endDate) {
      const dates: string[] = [];
      for (const ph of payload.phases) {
        for (const d of ph.days) dates.push(d.date);
      }
      dates.sort();
      endDate = dates[dates.length - 1] ?? null;
    }

    const updates: Record<string, unknown> = {
      project_name: payload.project_name,
      project_type: payload.project_type,
      office_profile: payload.office_profile ?? {},
      multi_home_move_type: payload.multi_home_move_type ?? null,
      start_date: payload.start_date,
      end_date: endDate,
      total_days: totalDays,
      origins: payload.origins,
      destinations: payload.destinations,
      total_price: payload.total_price ?? null,
      deposit: payload.deposit ?? null,
      payment_schedule: payload.payment_schedule ?? [],
      status: payload.status ?? undefined,
      coordinator_id: payload.coordinator_id ?? null,
      coordinator_name: payload.coordinator_name ?? null,
      special_instructions: payload.special_instructions ?? null,
      internal_notes: payload.internal_notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error: uErr } = await db.from("move_projects").update(updates).eq("id", id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
    try {
      await replaceMoveProjectTree(db, id, payload);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Tree replace failed" }, { status: 500 });
    }
    const fresh = await fetchMoveProjectWithTree(db, id);
    return NextResponse.json({ ...fresh.project, phases: fresh.phases });
  }

  const allowed = [
    "project_name",
    "project_type",
    "office_profile",
    "multi_home_move_type",
    "start_date",
    "end_date",
    "total_days",
    "origins",
    "destinations",
    "total_price",
    "deposit",
    "payment_schedule",
    "status",
    "coordinator_id",
    "coordinator_name",
    "special_instructions",
    "internal_notes",
    "quote_id",
    "contact_id",
    "partner_id",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await db.from("move_projects").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id } = await params;
  const db = createAdminClient();
  await db.from("quotes").update({ move_project_id: null }).eq("move_project_id", id);
  await db.from("moves").update({ move_project_id: null }).eq("move_project_id", id);
  const { error } = await db.from("move_projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
