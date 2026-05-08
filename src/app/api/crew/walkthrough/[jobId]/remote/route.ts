import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { signWalkthroughToken } from "@/lib/track-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getEmailFrom } from "@/lib/email/send";
import { getResend } from "@/lib/resend";

// ─────────────────────────────────────────────────────────────
// POST /api/crew/walkthrough/[jobId]/remote
// Crew sends a remote walkthrough link to the client when they
// are not present at the pickup address.
// ─────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  let moveId = jobId;
  let move: Record<string, unknown> | null = null;

  if (isUuid) {
    const { data } = await admin
      .from("moves")
      .select("id, crew_id, client_name, client_email, client_phone, move_code, coordinator_name, coordinator_phone")
      .eq("id", jobId)
      .maybeSingle();
    move = data as Record<string, unknown> | null;
  } else {
    const { data } = await admin
      .from("moves")
      .select("id, crew_id, client_name, client_email, client_phone, move_code, coordinator_name, coordinator_phone")
      .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
      .maybeSingle();
    move = data as Record<string, unknown> | null;
  }

  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
  if (move.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Not assigned to your team" }, { status: 403 });
  }

  moveId = move.id as string;
  const walkthroughToken = signWalkthroughToken(moveId);
  const base = getEmailBaseUrl();
  const walkthroughUrl = `${base}/walkthrough/${walkthroughToken}`;

  const firstName = (move.client_name as string | null)?.split(" ")[0] ?? "there";
  const clientPhone = move.client_phone as string | null;
  const clientEmail = move.client_email as string | null;
  const coordinatorPhone = move.coordinator_phone as string | null;

  const coordinatorLine = coordinatorPhone
    ? `\n\nQuestions? Reach your coordinator directly at ${coordinatorPhone}.`
    : "";
  const smsBody = [
    `Hi ${firstName},`,
    `Your Yugo crew has arrived at the pickup address, but we were unable to reach you on site.`,
    `Please complete a brief walkthrough so your crew can get started:\n${walkthroughUrl}${coordinatorLine}`,
  ].join("\n\n");

  if (clientPhone) {
    await sendSMS(normalizePhone(clientPhone), smsBody).catch((err) => {
      console.error("[WalkthroughRemote] SMS error:", err);
    });
  }

  if (clientEmail) {
    try {
      const resend = getResend();
      const from = await getEmailFrom();
      await resend.emails.send({
        from,
        to: clientEmail,
        subject: `Your Yugo crew is here and needs your walkthrough confirmation`,
        html: buildWalkthroughEmailHtml({
          firstName,
          walkthroughUrl,
          coordinatorPhone,
        }),
      });
    } catch (err) {
      console.error("[WalkthroughRemote] email error:", err);
    }
  }

  // Mark move as remote walkthrough pending
  await admin
    .from("moves")
    .update({
      walkthrough_remote_sent: true,
      walkthrough_remote_sent_at: new Date().toISOString(),
      walkthrough_remote_sent_by: payload.crewMemberId ?? null,
    })
    .eq("id", moveId);

  return NextResponse.json({ ok: true, walkthroughUrl });
}

function buildWalkthroughEmailHtml({
  firstName,
  walkthroughUrl,
  coordinatorPhone,
}: {
  firstName: string;
  walkthroughUrl: string;
  coordinatorPhone: string | null;
}): string {
  const coordinatorLine = coordinatorPhone
    ? `<p style="margin:0 0 16px;font-size:14px;color:#555;">Have questions? Call your coordinator at <a href="tel:${coordinatorPhone}" style="color:#5C1A33;">${coordinatorPhone}</a>.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#FFFBF7;border-radius:12px;overflow:hidden;border:1px solid #e8e0d8;">
        <tr><td style="background:#5C1A33;padding:28px 32px;text-align:center;">
          <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:4px;color:#FAF7F2;text-transform:uppercase;">YUGO</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:400;color:#2B0416;font-family:Georgia,serif;">Your crew has arrived</h1>
          <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">Hi ${firstName}, your moving crew is at your pickup address and ready to begin. Since you were not present, we need a quick confirmation from you before they start.</p>
          <p style="margin:0 0 24px;font-size:14px;color:#777;line-height:1.6;">This takes about 2 minutes. You will review your item list and confirm the crew can proceed.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#5C1A33;border-radius:8px;padding:14px 28px;">
              <a href="${walkthroughUrl}" style="display:block;font-size:14px;font-weight:700;color:#FAF7F2;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Complete walkthrough</a>
            </td></tr>
          </table>
          ${coordinatorLine}
          <p style="margin:0;font-size:12px;color:#aaa;">If you did not expect this message, please contact us immediately.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
