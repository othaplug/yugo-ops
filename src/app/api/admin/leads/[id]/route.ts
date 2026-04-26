import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { LEAD_SOURCE_LABELS } from "@/lib/leads/admin-labels";
import { LEAD_SERVICE_OMIT_MOVE_SIZE } from "@/lib/leads/lead-move-size";

const MAX_NOTE = 8000;
const MAX_ADDR = 8000;
const MAX_PHONE = 64;
const MAX_EMAIL = 320;
const MAX_MSG = 8000;

function optTrim(
  v: unknown,
  max: number,
): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t.slice(0, max) : null;
}

export const dynamic = "force-dynamic";

function touchResponse(
  patch: Record<string, unknown>,
  lead: { created_at: string; first_response_at: string | null },
  method: string,
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

  const { data: lead, error: lErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
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
  const { data: existing, error: exErr } = await sb
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();
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
  if (typeof body.move_size === "string" || body.move_size === null) {
    patch.move_size = body.move_size;
  }
  if (optTrim(body.phone, MAX_PHONE) !== undefined) {
    patch.phone = optTrim(body.phone, MAX_PHONE);
  }
  if (optTrim(body.email, MAX_EMAIL) !== undefined) {
    patch.email = optTrim(body.email, MAX_EMAIL);
  }
  if (typeof body.source === "string" && LEAD_SOURCE_LABELS[body.source]) {
    patch.source = body.source;
  }
  if (optTrim(body.source_detail, 500) !== undefined) {
    patch.source_detail = optTrim(body.source_detail, 500);
  }
  if (body.service_type !== undefined) {
    if (body.service_type === null) {
      patch.service_type = null;
    } else if (typeof body.service_type === "string") {
      const t = body.service_type.trim();
      patch.service_type = t ? t.slice(0, 64) : null;
      if (t && LEAD_SERVICE_OMIT_MOVE_SIZE.has(t)) {
        patch.move_size = null;
      }
    }
  }
  if (optTrim(body.from_address, MAX_ADDR) !== undefined) {
    patch.from_address = optTrim(body.from_address, MAX_ADDR);
  }
  if (optTrim(body.to_address, MAX_ADDR) !== undefined) {
    patch.to_address = optTrim(body.to_address, MAX_ADDR);
  }
  if (optTrim(body.message, MAX_MSG) !== undefined) {
    patch.message = optTrim(body.message, MAX_MSG);
  }
  if (body.preferred_date !== undefined) {
    if (body.preferred_date === null) {
      patch.preferred_date = null;
    } else if (typeof body.preferred_date === "string") {
      const d = body.preferred_date.trim();
      if (!d) {
        patch.preferred_date = null;
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        patch.preferred_date = d;
      }
    }
  }
  if (typeof body.lost_reason === "string")
    patch.lost_reason = body.lost_reason;
  if (typeof body.assigned_to === "string" || body.assigned_to === null) {
    patch.assigned_to = body.assigned_to;
    if (body.assigned_to) patch.assigned_at = new Date().toISOString();
  }
  if (typeof body.note === "string" && body.note.trim()) {
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "note_added",
      notes: body.note.trim().slice(0, MAX_NOTE),
      performed_by: user?.id ?? null,
    });
  }

  const responseAction = body.response_action as string | undefined;
  if (responseAction === "phone_call") {
    touchResponse(
      patch,
      existing as { created_at: string; first_response_at: string | null },
      "phone_call",
    );
    if (!patch.status) patch.status = "contacted";
    await sb.from("lead_activities").insert({
      lead_id: id,
      activity_type: "contacted",
      performed_by: user?.id ?? null,
      notes: (body.call_notes as string) || null,
    });
  } else if (responseAction === "sms") {
    touchResponse(
      patch,
      existing as { created_at: string; first_response_at: string | null },
      "sms",
    );
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
    touchResponse(
      patch,
      existing as { created_at: string; first_response_at: string | null },
      "email",
    );
  }

  if (body.clear_photo_intake === true) {
    await sb
      .from("photo_surveys")
      .delete()
      .eq("lead_id", id)
      .eq("status", "pending");
    const clearPatch: Record<string, unknown> = {
      photo_survey_token: null,
      photos_requested_at: null,
      photos_uploaded_at: null,
      photo_count: 0,
    };
    for (const [k, v] of Object.entries(clearPatch)) {
      patch[k] = v;
    }
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
