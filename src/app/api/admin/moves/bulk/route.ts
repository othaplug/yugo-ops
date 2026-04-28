import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { ensureJobCompleted, runMoveCompletionFollowUp } from "@/lib/moves/complete-move-job";

/** POST /api/admin/moves/bulk — Bulk status updates for moves */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let body: { action: string; ids: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, ids } = body;
  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "action and ids[] required" }, { status: 400 });
  }

  const validActions = ["complete", "cancel"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (action === "complete") {
    const failures: string[] = [];
    for (const moveId of ids) {
      const { wasAlreadyComplete, ok, error } = await ensureJobCompleted(admin, {
        jobId: moveId,
        jobType: "move",
        completedAt: now,
      });
      if (!ok) {
        failures.push(`${moveId}: ${error || "unknown"}`);
        continue;
      }
      if (!wasAlreadyComplete) {
        await runMoveCompletionFollowUp(admin, moveId, { source: "admin_bulk" });
      }
    }
    if (failures.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Some moves could not be marked complete", failures },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  const { error } = await admin
    .from("moves")
    .update({ status: "cancelled", updated_at: now })
    .in("id", ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, updated: ids.length });
}
