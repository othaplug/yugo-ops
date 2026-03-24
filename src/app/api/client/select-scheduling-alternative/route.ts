import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/client/select-scheduling-alternative
 * Body: { moveId, alternativeId }
 *
 * Marks the chosen alternative as selected and updates the move status
 * to confirmed_pending_schedule → scheduled (coordinator still assigns crew).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { moveId?: string; alternativeId?: string };
  if (!body.moveId || !body.alternativeId) {
    return NextResponse.json({ error: "moveId and alternativeId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the selected alternative
  const { data: alt, error: altErr } = await admin
    .from("scheduling_alternatives")
    .select("*")
    .eq("id", body.alternativeId)
    .eq("move_id", body.moveId)
    .single();

  if (altErr || !alt) {
    return NextResponse.json({ error: "Alternative not found" }, { status: 404 });
  }

  // Mark selected
  await admin
    .from("scheduling_alternatives")
    .update({ is_selected: true, selected_at: new Date().toISOString() })
    .eq("id", body.alternativeId);

  // Update move with the chosen date/window and move status to scheduled
  await admin
    .from("moves")
    .update({
      move_date: alt.alt_date,
      arrival_window: alt.alt_window,
      status: "scheduled",
    })
    .eq("id", body.moveId);

  // Notify coordinator
  const { notifyAdmins } = await import("@/lib/notifications/dispatch");
  await notifyAdmins("move_scheduled", {
    moveId: body.moveId,
    subject: "Client selected alternative slot",
    body: `Client chose ${alt.alt_date} ${alt.alt_window}${alt.team_name ? `, ${alt.team_name}` : ""} for move ${body.moveId}.`,
    description: `Client chose ${alt.alt_date} ${alt.alt_window} for their move.`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
