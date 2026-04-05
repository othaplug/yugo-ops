import { NextRequest, NextResponse } from "next/server";
import { getAdminNotificationEmail } from "@/lib/config";
import { preMoveChecklistCompleteAdminEmailHtml } from "@/lib/email/admin-templates";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { isPreMoveChecklistComplete } from "@/lib/pre-move-checklist";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { token, item, checked } = await req.json();

  if (!token || !item) {
    return NextResponse.json({ error: "Missing token or item" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: move } = await supabase
    .from("moves")
    .select(
      "id, pre_move_checklist, pre_move_checklist_notified_at, client_name, move_code, scheduled_date, coordinator_email",
    )
    .eq("id", id)
    .single();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!verifyTrackToken("move", move.id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = (move.pre_move_checklist as Record<string, boolean>) || {};
  const updated = { ...current, [item]: Boolean(checked) };
  const wasComplete = isPreMoveChecklistComplete(current);
  const nowComplete = isPreMoveChecklistComplete(updated);
  const alreadyNotified = Boolean(
    (move as { pre_move_checklist_notified_at?: string | null }).pre_move_checklist_notified_at,
  );

  const { error: updErr } = await supabase
    .from("moves")
    .update({ pre_move_checklist: updated })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message || "Update failed" }, { status: 500 });
  }

  if (nowComplete && !wasComplete && !alreadyNotified && process.env.RESEND_API_KEY) {
    try {
      const moveCode = String(move.move_code || move.id).trim() || move.id;
      const clientName = String(move.client_name || "Client").trim() || "Client";
      const schedRaw = move.scheduled_date as string | null | undefined;
      let scheduledDateLabel: string | null = null;
      if (schedRaw && /^\d{4}-\d{2}-\d{2}/.test(schedRaw)) {
        const d = new Date(schedRaw.slice(0, 10) + "T12:00:00");
        if (!Number.isNaN(d.getTime())) {
          scheduledDateLabel = d.toLocaleDateString("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        }
      }
      const baseUrl = getEmailBaseUrl();
      const adminMoveUrl = `${baseUrl}/admin/moves/${encodeURIComponent(move.move_code || move.id)}`;
      const html = preMoveChecklistCompleteAdminEmailHtml({
        clientName,
        moveCode,
        scheduledDateLabel,
        adminMoveUrl,
      });
      const subject = `Prep checklist complete · ${moveCode} · ${clientName}`;
      const adminEmail = (await getAdminNotificationEmail()).trim();
      const adminResult = await sendEmail({ to: adminEmail, subject, html });
      if (!adminResult.success) {
        console.error("[checklist] Admin prep email failed", adminResult.error);
      } else {
        const coordRaw = String((move.coordinator_email as string | null) || "").trim();
        if (
          coordRaw.includes("@") &&
          coordRaw.toLowerCase() !== adminEmail.toLowerCase()
        ) {
          const coordResult = await sendEmail({ to: coordRaw, subject, html });
          if (!coordResult.success) {
            console.error("[checklist] Coordinator prep email failed", coordResult.error);
          }
        }
        const { error: stampErr } = await supabase
          .from("moves")
          .update({ pre_move_checklist_notified_at: new Date().toISOString() })
          .eq("id", id);
        if (stampErr) {
          console.error("[checklist] Failed to set pre_move_checklist_notified_at", stampErr);
        }
      }
    } catch (e) {
      console.error("[checklist] Prep complete notify error", e);
    }
  }

  return NextResponse.json({ ok: true, checklist: updated });
}
