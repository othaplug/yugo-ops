import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/track-token";
import { recordReviewOptOut } from "@/lib/review/opt-out";

/**
 * Permanent review unsubscribe, reached from the discreet footer link in a
 * review email. Records the opt-out (honoured across every future job) and
 * cancels the remaining touches for this move. GET so it works from an email
 * client, and idempotent so a second click is harmless.
 */
function page(title: string, body: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#F9EDE4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:460px;margin:0 auto;padding:64px 24px;text-align:center;">
    <div style="font-size:22px;font-weight:700;color:#492A1D;letter-spacing:2px;">YUGO</div>
    <h1 style="font-size:22px;color:#2B0416;margin:28px 0 12px;font-weight:600;">${title}</h1>
    <p style="font-size:15px;color:#4F4B47;line-height:1.6;margin:0;">${body}</p>
  </div>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const reviewRequestId = verifyReviewToken(token);
  if (!reviewRequestId) {
    return page(
      "This link has expired",
      "If you would rather not receive these notes, reply to any Yugo email and we will take care of it.",
    );
  }

  const admin = createAdminClient();
  const { data: rr } = await admin
    .from("review_requests")
    .select("id, client_email, client_phone")
    .eq("id", reviewRequestId)
    .maybeSingle();

  await recordReviewOptOut(admin, {
    email: rr?.client_email,
    phone: rr?.client_phone,
    reason: "email_unsubscribe",
  });

  if (rr?.id) {
    await admin.from("review_requests").update({ status: "cancelled" }).eq("id", rr.id);
  }

  return page(
    "You are unsubscribed",
    "You will not receive further review notes from Yugo. Thank you for trusting us with your move.",
  );
}
