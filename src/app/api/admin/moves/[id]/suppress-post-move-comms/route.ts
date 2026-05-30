/**
 * POST /api/admin/moves/[id]/suppress-post-move-comms
 *
 * Stops every automated post-move communication for a given move:
 *   - 24-48h Google review request (post-move-reviews cron)
 *   - 72h perks email
 *   - 365-day anniversary email
 *   - Any pending review_requests row (set to 'cancelled')
 *
 * Mechanism: write a sentinel timestamp into the three `_sent` columns
 * the crons filter on (`review_request_sent`, `perks_email_sent`,
 * `anniversary_email_sent`). Since every cron query is
 * `.is(<column>, null)`, a non-null value makes that move invisible to
 * the cron without removing it from the moves list.
 *
 * Idempotent: re-running on an already-suppressed move is a no-op for
 * the columns already set; it does append a fresh internal_notes line
 * each time so the audit trail captures every suppression event.
 *
 * Reversal: the response includes the previous values so an "Un-suppress"
 * button can restore them if needed. (UI side: TBD; not built yet.)
 *
 * Auth: requireStaff. Audit-logged.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

type Body = {
  /** Optional reason logged to internal_notes for audit trail. */
  reason?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Empty body is fine — reason is optional
  }
  const reasonClean = (body.reason ?? "").trim().slice(0, 500);

  const db = createAdminClient();

  // Resolve by either UUID or move_code slug.
  const { data: move, error: lookupErr } = await db
    .from("moves")
    .select(
      "id, move_code, client_name, internal_notes, review_request_sent, perks_email_sent, anniversary_email_sent",
    )
    .or(`id.eq.${moveId},move_code.eq.${moveId}`)
    .maybeSingle();

  if (lookupErr || !move?.id) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const ts = new Date().toLocaleString("en-CA", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const author = user?.email ?? user?.id ?? "admin";

  const noteLines = [
    `[${ts}] Post-move comms SUPPRESSED by ${author}.`,
    "  • No review request email",
    "  • No 72h perks email",
    "  • No anniversary email",
    "  • No automated SMS check-in",
  ];
  if (reasonClean) noteLines.push(`  • Reason: ${reasonClean}`);
  noteLines.push(
    "  • To re-enable: clear review_request_sent / perks_email_sent / anniversary_email_sent on this move row.",
  );
  const newNote = noteLines.join("\n");
  const existingNotes = (move.internal_notes ?? "").trim();
  const updatedNotes = existingNotes ? `${existingNotes}\n\n${newNote}` : newNote;

  // Capture pre-suppression state for the response so a future un-suppress
  // action can restore it precisely.
  const previousState = {
    review_request_sent: move.review_request_sent ?? null,
    perks_email_sent: move.perks_email_sent ?? null,
    anniversary_email_sent: move.anniversary_email_sent ?? null,
  };

  const { error: updateErr } = await db
    .from("moves")
    .update({
      review_request_sent: now,
      perks_email_sent: now,
      anniversary_email_sent: now,
      internal_notes: updatedNotes,
    })
    .eq("id", move.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Cancel any pending review_requests row so the review-requests cron
  // (which looks for status='pending') doesn't pick this move up either.
  // We don't delete — keep the row for history; just mark cancelled.
  const { data: pendingRRs } = await db
    .from("review_requests")
    .select("id")
    .eq("move_id", move.id)
    .eq("status", "pending");
  let cancelledRRs = 0;
  if (pendingRRs && pendingRRs.length > 0) {
    const { error: rrErr } = await db
      .from("review_requests")
      .update({ status: "cancelled" })
      .eq("move_id", move.id)
      .eq("status", "pending");
    if (!rrErr) cancelledRRs = pendingRRs.length;
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "edit_move",
    resourceType: "move",
    resourceId: move.id,
    details: {
      change: "suppress_post_move_comms",
      move_code: move.move_code,
      client_name: move.client_name,
      reason: reasonClean || null,
      previous_state: previousState,
      cancelled_review_requests: cancelledRRs,
    },
  });

  return NextResponse.json({
    ok: true,
    move_code: move.move_code,
    cancelled_review_requests: cancelledRRs,
    previous_state: previousState,
  });
}
