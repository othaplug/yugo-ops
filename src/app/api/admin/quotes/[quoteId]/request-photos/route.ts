import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { signPhotoSurveyToken } from "@/lib/track-token";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getEmailFrom } from "@/lib/email/send";
import { getResend } from "@/lib/resend";

// POST /api/admin/quotes/[quoteId]/request-photos
// Coordinator triggers a photo survey request for a quote contact.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: quote } = await admin
    .from("quotes")
    .select("id, quote_id, contact_name, contact_email, contact_phone, client_name, client_email, client_phone, photo_survey_sent_at")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const firstName =
    ((quote.contact_name ?? quote.client_name ?? "") as string).split(" ")[0] || "there";
  const phone = normalizePhone(
    (quote.contact_phone ?? quote.client_phone ?? "") as string,
  );
  const email = (quote.contact_email ?? quote.client_email ?? "") as string;

  const surveyToken = signPhotoSurveyToken(quoteId);
  const base = getEmailBaseUrl();
  const surveyUrl = `${base}/survey/${surveyToken}`;

  if (phone) {
    await sendSMS(
      phone,
      `Hi ${firstName}, to prepare your Yugo quote please share quick room-by-room photos using this link: ${surveyUrl}`,
    ).catch((err) => {
      console.error("[RequestPhotos] SMS error:", err);
    });
  }

  if (email) {
    try {
      const resend = getResend();
      const from = await getEmailFrom();
      await resend.emails.send({
        from,
        to: email,
        subject: `Share photos of your home to get your moving quote`,
        html: buildPhotoRequestEmailHtml({ firstName, surveyUrl }),
      });
    } catch (err) {
      console.error("[RequestPhotos] email error:", err);
    }
  }

  await admin
    .from("quotes")
    .update({ photo_survey_sent_at: new Date().toISOString() })
    .eq("quote_id", quoteId);

  return NextResponse.json({ ok: true, surveyUrl });
}

function buildPhotoRequestEmailHtml({
  firstName,
  surveyUrl,
}: {
  firstName: string;
  surveyUrl: string;
}): string {
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
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:400;color:#2B0416;font-family:Georgia,serif;">Help us see your home</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">Hi ${firstName}, to give you the most accurate moving quote possible, we would love to see your space. Quick room-by-room photos take about 5 minutes and help us make sure everything is covered.</p>
          <p style="margin:0 0 24px;font-size:14px;color:#777;line-height:1.6;">There is nothing to prepare — just snap a quick shot of each room and upload below.</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
            <tr><td style="background:#5C1A33;border-radius:8px;padding:14px 28px;">
              <a href="${surveyUrl}" style="display:block;font-size:14px;font-weight:700;color:#FAF7F2;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">Share photos</a>
            </td></tr>
          </table>
          <p style="margin:0;font-size:12px;color:#aaa;">Your photos are only seen by your coordinator and moving team. They are never shared or used for any other purpose.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
