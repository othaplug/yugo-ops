import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/moves/[id]/restart
 * Restart a completed move: set status to new value, clear stage, end any active tracking sessions.
 * Called when admin changes status from completed back to in_progress, paid, etc.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const { id: moveId } = await params;
    const body = await req.json();
    const newStatus = (body.newStatus || body.status || "").trim();

    if (!newStatus) {
      return NextResponse.json({ error: "newStatus required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: move, error: fetchErr } = await admin
      .from("moves")
      .select("id, status")
      .eq("id", moveId)
      .single();

    if (fetchErr || !move) {
      return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }

    const isCompleted = ["completed", "delivered"].includes((move.status || "").toLowerCase());
    if (!isCompleted) {
      return NextResponse.json({ error: "Move is not completed; use regular status update" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. Update move: new status, clear stage
    const { data: updatedMove, error: moveErr } = await admin
      .from("moves")
      .update({
        status: newStatus,
        stage: null,
        updated_at: now,
      })
      .eq("id", moveId)
      .select()
      .single();

    if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 500 });

    // 2. End any active tracking sessions for this move (so crew can start fresh)
    await admin
      .from("tracking_sessions")
      .update({
        is_active: false,
        completed_at: now,
        updated_at: now,
      })
      .eq("job_id", moveId)
      .eq("job_type", "move")
      .eq("is_active", true);

    return NextResponse.json({ ok: true, move: updatedMove });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to restart move" },
      { status: 500 }
    );
  }
}
