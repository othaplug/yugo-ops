import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function touchResponse(
  patch: Record<string, unknown>,
  lead: { created_at: string; first_response_at: string | null },
  method: string
) {
  if (lead.first_response_at) return patch;
  const now = new Date().toISOString();
  const sec = Math.max(
    0,
    Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 1000),
  );
  patch.first_response_at = now;
  patch.response_time_seconds = sec;
  patch.response_method = method;
  return patch;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await ctx.params;
  const sb = createAdminClient();

  const { data: lead, error: lErr } = await sb.from("leads").select("*").eq("id", id).single();
  if (lErr || !lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: activities } = await sb
    .from("lead_activities")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ lead, activities: activities ?? [] });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: existing, error: exErr } = await sb.from("leads").select("*").eq("id", id).single();
  if (exErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.record_view === true) {
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "viewed",
      notes: null,
      performed_by: user?.id ?? null,
    });
    return NextResponse.json({ ok: true, viewed: true });
  }

  const patch: Record<string, unknown> = {};
  const prevStatus = existing.status as string;

  if (typeof body.status === "string") patch.status = body.status;
  if (typeof body.lost_reason === "string") patch.lost_reason = body.lost_reason;
  if (typeof body.assigned_to === "string" || body.assigned_to === null) {
    patch.assigned_to = body.assigned_to;
    if (body.assigned_to) patch.assigned_at = new Date().toISOString();
  }
  if (typeof body.note === "string" && body.note.trim()) {
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "note_added",
      notes: body.note.trim(),
      performed_by: user?.id ?? null,
    });
  }

  const responseAction = body.response_action as string | undefined;
  if (responseAction === "phone_call") {
    touchResponse(patch, existing as { created_at: string; first_response_at: string | null }, "phone_call");
    if (!patch.status) patch.status = "contacted";
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "contacted",
      performed_by: user?.id ?? null,
      notes: (body.call_notes as string) || null,
    });
  } else if (responseAction === "sms") {
    touchResponse(patch, existing as { created_at: string; first_response_at: string | null }, "sms");
    if (!patch.status) patch.status = "contacted";
  }

  if (typeof body.status === "string" && body.status !== prevStatus) {
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "status_changed",
      notes: `${prevStatus} → ${body.status}`,
      performed_by: user?.id ?? null,
    });
  }

  if (body.status === "disqualified" && !patch.response_method) {
    touchResponse(patch, existing as { created_at: string; first_response_at: string | null }, "email");
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ lead: existing });
  }

  const { data: updated, error: uErr } = await sb
    .from("leads")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ lead: updated });
}
