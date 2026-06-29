/**
 * POST /api/admin/moves/[id]/send-move-reminder
 *
 * Manual trigger for the pre-move-day reminder: sends the same email +
 * SMS that the daily cron sends at T-24h. Used when:
 *   - a move has slipped past its automated reminder window
 *     (status flipped to "paid" before the cron-fix landed, etc.)
 *   - an operator wants to re-send to a corrected email address
 *   - the move was rescheduled and needs a fresh "tomorrow" nudge
 *
 * Mirrors the body of the T-24 Hour branch in
 * src/app/api/cron/pre-move-emails/route.ts so client-facing copy stays
 * identical. Marks pre_move_24hr_sent on success so a subsequent cron
 * sweep doesn't double-send.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { sendMoveReminderSms } from "@/lib/quote-sms";
import { getMoveCrewSize } from "@/lib/moves/crew-size";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveSlug } = await params;
  const db = createAdminClient();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    moveSlug,
  );
  const moveQuery = db
    .from("moves")
    .select(
      `id, move_code, client_name, client_email, client_phone,
       scheduled_date, scheduled_time, from_address, to_address,
       crew_size, est_crew_size, assigned_members,
       truck_info, arrival_window, tier_selected, status`,
    );
  const { data: move, error: moveErr } = isUuid
    ? await moveQuery.eq("id", moveSlug).maybeSingle()
    : await moveQuery.eq("move_code", moveSlug).maybeSingle();

  if (moveErr) {
    return NextResponse.json({ error: moveErr.message }, { status: 500 });
  }
  if (!move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }
  if (!move.client_email && !move.client_phone) {
    return NextResponse.json(
      { error: "Move has no client_email or client_phone — cannot send a reminder." },
      { status: 400 },
    );
  }

  const baseUrl = getEmailBaseUrl();
  const trackToken = signTrackToken("move", move.id);
  const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

  const assignedNames = Array.isArray(move.assigned_members)
    ? (move.assigned_members as unknown[])
        .map((n) => String(n ?? "").trim())
        .filter(Boolean)
    : [];
  const crewSize = getMoveCrewSize({
    assigned_members: move.assigned_members as string[] | null | undefined,
    crew_size: move.crew_size as number | null | undefined,
    est_crew_size: move.est_crew_size as number | null | undefined,
  });

  const { data: coordConfig } = await db
    .from("platform_config")
    .select("key, value")
    .in("key", ["coordinator_name", "coordinator_phone"]);
  const coordinatorName =
    coordConfig?.find((c) => c.key === "coordinator_name")?.value || null;
  const coordinatorPhone =
    coordConfig?.find((c) => c.key === "coordinator_phone")?.value || null;

  const isEstate =
    String(move.tier_selected || "").toLowerCase().trim() === "estate";

  let emailOk = false;
  let emailError: string | null = null;
  if (move.client_email) {
    try {
      const r = await sendEmail({
        to: move.client_email,
        subject: isEstate
          ? `Your Estate crew is confirmed for tomorrow - ${move.move_code || "Details"}`
          : `Your crew is confirmed for tomorrow - ${move.move_code || "Details"}`,
        template: "pre-move-24hr",
        data: {
          clientName: move.client_name || "",
          moveCode: move.move_code || move.id,
          moveDate: move.scheduled_date,
          fromAddress: move.from_address || "",
          toAddress: move.to_address || "",
          crewMembers: assignedNames,
          crewSize,
          truckInfo: move.truck_info || null,
          arrivalWindow: move.arrival_window || move.scheduled_time || null,
          coordinatorName,
          coordinatorPhone,
          trackingUrl,
        },
      });
      emailOk = !!r.success;
      if (!r.success) emailError = r.error || "send failed";
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
    }
  }

  let smsOk = false;
  let smsError: string | null = null;
  if (move.client_phone) {
    try {
      await sendMoveReminderSms({
        phone: move.client_phone,
        moveCode: move.move_code || move.id,
        clientName: move.client_name || undefined,
        moveDate: move.scheduled_date,
        scheduledTime: move.arrival_window || move.scheduled_time || null,
        crewSize: crewSize ?? null,
        trackingUrl,
        reminderType: "24hr",
      });
      smsOk = true;
    } catch (err) {
      smsError = err instanceof Error ? err.message : String(err);
    }
  }

  if (emailOk || smsOk) {
    await db
      .from("moves")
      .update({ pre_move_24hr_sent: new Date().toISOString() })
      .eq("id", move.id);
  }

  await logAudit({
    userEmail: user?.email ?? null,
    action: "edit_move",
    resourceType: "move",
    resourceId: move.id,
    details: {
      kind: "manual_pre_move_reminder",
      move_code: move.move_code,
      emailOk,
      smsOk,
      emailError,
      smsError,
    },
  });

  return NextResponse.json({
    ok: emailOk || smsOk,
    emailOk,
    smsOk,
    emailError,
    smsError,
  });
}
