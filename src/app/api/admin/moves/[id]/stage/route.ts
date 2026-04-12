import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** GET move stage/status for live polling. Staff only. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  const admin = createAdminClient();
  const { data, error: fetchErr } = await admin
    .from("moves")
    .select("stage, status, updated_at, completed_at")
    .eq("id", id)
    .single();

  if (fetchErr || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const st = (data.status || "").toLowerCase();
  const terminal = st === "completed" || st === "cancelled" || st === "delivered";
  if (!terminal) {
    const { data: sessionRows } = await admin
      .from("tracking_sessions")
      .select("status, completed_at, created_at")
      .eq("job_id", id)
      .eq("job_type", "move");
    let best: { status: string; completed_at: string | null; created_at: string } | null = null;
    for (const r of sessionRows || []) {
      const created = String((r as { created_at?: string }).created_at || "");
      if (!best || created > best.created_at) {
        best = {
          status: String(r.status || ""),
          completed_at: (r.completed_at as string | null) ?? null,
          created_at: created,
        };
      }
    }
    if (best?.status?.toLowerCase() === "completed") {
      return NextResponse.json(
        {
          ...data,
          status: "completed",
          stage: "completed",
          completed_at: best.completed_at ?? data.completed_at,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
