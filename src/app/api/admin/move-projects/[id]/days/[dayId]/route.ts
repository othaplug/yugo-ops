import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { updateMoveProjectDayBodySchema } from "@/lib/move-projects/schema";

export const dynamic = "force-dynamic";

function normalizeTime(t: string | null | undefined): string | null {
  if (t == null || !String(t).trim()) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const hh = m[1]!.padStart(2, "0");
  const mm = m[2]!;
  return `${hh}:${mm}:00`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  const { id: projectId, dayId } = await params;
  const db = createAdminClient();

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = updateMoveProjectDayBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: day, error: dErr } = await db
    .from("move_project_days")
    .select("id, project_id")
    .eq("id", dayId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (dErr || !day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }

  const p = parsed.data;
  const updates: Record<string, unknown> = {};

  if (p.crew_ids !== undefined) {
    updates.crew_ids = p.crew_ids && p.crew_ids.length > 0 ? p.crew_ids : null;
  }
  if (p.start_time !== undefined) {
    updates.start_time =
      p.start_time === null || (typeof p.start_time === "string" && !p.start_time.trim())
        ? null
        : normalizeTime(p.start_time);
  }
  if (p.end_time !== undefined) {
    updates.end_time =
      p.end_time === null || (typeof p.end_time === "string" && !p.end_time.trim())
        ? null
        : normalizeTime(p.end_time);
  }
  if (p.arrival_window !== undefined) updates.arrival_window = p.arrival_window?.trim() || null;
  if (p.origin_address !== undefined) updates.origin_address = p.origin_address?.trim() || null;
  if (p.destination_address !== undefined) updates.destination_address = p.destination_address?.trim() || null;
  if (p.date !== undefined && p.date) updates.date = p.date;
  if (p.label !== undefined && p.label) updates.label = p.label;
  if (p.description !== undefined) updates.description = p.description?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { error: uErr } = await db.from("move_project_days").update(updates).eq("id", dayId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
