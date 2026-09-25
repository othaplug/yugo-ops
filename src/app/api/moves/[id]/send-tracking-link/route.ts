import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { trackingLinkEmail } from "@/lib/email-templates";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getMoveCode, formatJobId, getTrackMoveSlug } from "@/lib/move-code";
import { requireStaff } from "@/lib/api-auth";
import { getEmailFrom } from "@/lib/email/send";
import { getMoveClientRecipients, recipientsWithEmail, recipientsWithPhone } from "@/lib/moves/move-recipients";
import { sendSMS } from "@/lib/sms/sendSMS";
import { buildSmsTrackUrl } from "@/lib/notifications/public-track-url";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: move } = await supabase
      .from("moves")
      .select("id, client_name, client_email, estimate, move_code, client_phone, additional_contacts")
      .eq("id", id)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const name = (move.client_name || "").trim();
    const recipients = getMoveClientRecipients(move, "tracking");
    // Primary + additional tracking contacts, split by reachable channel (deduped).
    const emailRecipients = recipientsWithEmail(recipients);
    const phoneRecipients = recipientsWithPhone(recipients);
    if (emailRecipients.length === 0 && phoneRecipients.length === 0) {
      return NextResponse.json(
        { error: "Add a client email or phone first" },
        { status: 400 },
      );
    }

    const trackUrl = `${getEmailBaseUrl()}/track/move/${getTrackMoveSlug(move)}?token=${signTrackToken("move", move.id)}`;
    const moveCode = getMoveCode(move);
    const jobIdDisplay = formatJobId(moveCode, "move");

    let firstError: string | null = null;
    let emailsSent = 0;
    let smsSent = 0;

    // ── Email ── (skipped if email not configured — SMS can still go)
    const emailConfigured =
      !!process.env.RESEND_API_KEY &&
      process.env.RESEND_API_KEY !== "re_your_api_key_here";
    if (emailConfigured && emailRecipients.length > 0) {
      const resend = getResend();
      const emailFrom = await getEmailFrom();
      for (const r of emailRecipients) {
        const to = (r.email || "").trim().toLowerCase();
        if (!to) continue;
        const { error: sendError } = await resend.emails.send({
          from: emailFrom,
          to,
          subject: `Your move is scheduled ${jobIdDisplay}`,
          html: trackingLinkEmail({
            clientName: (r.name || "").trim() || name || "there",
            trackUrl,
            moveNumber: jobIdDisplay,
          }),
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });
        if (sendError && !firstError) {
          firstError =
            typeof sendError === "object" && sendError !== null && "message" in sendError
              ? String((sendError as { message?: string }).message)
              : String(sendError);
        } else if (!sendError) {
          emailsSent++;
        }
      }
    }

    // ── SMS ── the tracking link to each distinct phone (primary + additional)
    if (phoneRecipients.length > 0) {
      const smsUrl = moveCode ? buildSmsTrackUrl(moveCode) : trackUrl;
      for (const r of phoneRecipients) {
        const to = (r.phone || "").trim();
        if (!to) continue;
        const greet = (r.name || "").trim().split(" ")[0] || name.split(" ")[0] || "there";
        const body = `Hi ${greet}, it's Yugo. Track your move ${jobIdDisplay} anytime: ${smsUrl}. Questions? Call (647) 370-4525.`;
        const res = await sendSMS(to, body);
        if (res.success) smsSent++;
        else if (!firstError) firstError = res.error || "SMS failed to send";
      }
    }

    if (firstError && emailsSent === 0 && smsSent === 0) {
      return NextResponse.json({ error: firstError }, { status: 500 });
    }

    return NextResponse.json({ ok: true, emailsSent, smsSent, error: firstError ?? undefined });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send tracking link";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
