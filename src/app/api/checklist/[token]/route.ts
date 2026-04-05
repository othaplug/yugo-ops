import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** PATCH: update extended_checklist_progress JSONB by checklist_token */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = String(token || "").trim();
  if (!t) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const body = (await req.json()) as { checked?: Record<string, boolean> };
  if (!body.checked || typeof body.checked !== "object") {
    return NextResponse.json({ error: "checked object required" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: move, error: mErr } = await sb
    .from("moves")
    .select("id, extended_checklist_progress")
    .eq("checklist_token", t)
    .maybeSingle();

  if (mErr || !move) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prev = (move.extended_checklist_progress as Record<string, boolean>) || {};
  const next = { ...prev, ...body.checked };

  const { error: upErr } = await sb
    .from("moves")
    .update({ extended_checklist_progress: next })
    .eq("id", move.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, progress: next });
}
