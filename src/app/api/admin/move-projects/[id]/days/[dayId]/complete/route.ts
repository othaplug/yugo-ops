import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { completeDayBodySchema } from "@/lib/move-projects/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; dayId: string }> }) {
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
  const parsed = completeDayBodySchema.safeParse(body);
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

  const { error: uErr } = await db
    .from("move_project_days")
    .update({
      status: parsed.data.status,
      completion_notes: parsed.data.completion_notes ?? null,
    })
    .eq("id", dayId);

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
