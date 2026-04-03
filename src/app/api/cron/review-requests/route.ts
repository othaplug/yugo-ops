import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken, signReviewToken } from "@/lib/track-token";
import { getTrackMoveSlug } from "@/lib/move-code";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date().toISOString();

  const { data: configRows } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", ["auto_review_requests", "coordinator_name"]);

  const config: Record<string, string> = {};
  for (const r of configRows || []) config[r.key] = r.value;

  if (config.auto_review_requests !== "true" && config.auto_review_requests !== "1") {
    return NextResponse.json({ ok: true, skipped: "feature disabled" });
  }

  const coordinatorName = config.coordinator_name || null;

  let sent = 0;
  let reminded = 0;
  const errors: string[] = [];

  // 1. Send pending review requests (scheduled_send_at <= now)
  const { data: pending } = await supabase
    .from("review_requests")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_send_at", now);

  for (const rr of pending || []) {
    const token = signReviewToken(rr.id);
    const reviewUrl = `${baseUrl}/review?token=${encodeURIComponent(token)}`;
    const reviewRedirectUrl = `${baseUrl}/api/review/redirect?token=${encodeURIComponent(token)}`;
    const tier = (rr.tier || "essential").toLowerCase();
    const { data: move } = rr.move_id
      ? await supabase.from("moves").select("move_code, id").eq("id", rr.move_id).single()
      : { data: null };
    const trackSlug = move ? getTrackMoveSlug({ move_code: move.move_code, id: move.id }) : rr.move_id;
    const trackToken = rr.move_id ? signTrackToken("move", rr.move_id) : "";
    const trackingUrl = trackSlug ? `${baseUrl}/track/move/${trackSlug}?token=${trackToken}` : baseUrl;
    const template =
      tier === "estate"
        ? "review-request-estate"
        : tier === "signature" || tier === "premier"
          ? "review-request-signature"
          : "review-request-essential";

    const firstName = (rr.client_name || "").trim().split(/\s+/)[0] || "";

    if (rr.client_email) {
      try {
        const subject =
          tier === "estate"
            ? `${firstName}, it was our privilege how did we do?`
            : tier === "signature" || tier === "premier"
              ? `We'd love your feedback, ${firstName}`
              : `How was your Yugo move, ${firstName}?`;

        await sendEmail({
          to: rr.client_email,
          subject,
          template,
          data: {
            clientName: rr.client_name,
            tier: rr.tier,
            reviewUrl,
            reviewRedirectUrl,
            referralUrl: null,
            trackingUrl,
            coordinatorName,
          },
        });
      } catch (e) {
        errors.push(`email:${rr.id}:${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (rr.client_phone) {
      try {
        const { success, error } = await sendSMS(
          rr.client_phone,
          [
            firstName ? `Hi ${firstName},` : "Hi,",
            `Your Yugo move is complete.`,
            `We'd love a quick Google review when you have a moment.`,
            reviewUrl,
          ].join("\n\n"),
        );
        if (!success) errors.push(`sms:${rr.id}:${error || "failed"}`);
      } catch (e) {
        errors.push(`sms:${rr.id}:${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await supabase
      .from("review_requests")
      .update({
        status: "sent",
        email_sent_at: rr.client_email ? new Date().toISOString() : null,
        sms_sent_at: rr.client_phone ? new Date().toISOString() : null,
      })
      .eq("id", rr.id);
    sent++;
  }

  // 2. Send reminders (status=sent, reminder_send_at <= now, not clicked)
  const { data: toRemind } = await supabase
    .from("review_requests")
    .select("*")
    .eq("status", "sent")
    .eq("review_clicked", false)
    .lte("reminder_send_at", now);

  for (const rr of toRemind || []) {
    const remindToken = signReviewToken(rr.id);
    const reviewUrl = `${baseUrl}/review?token=${encodeURIComponent(remindToken)}`;
    const reviewRedirectUrl = `${baseUrl}/api/review/redirect?token=${encodeURIComponent(remindToken)}`;

    if (rr.client_email) {
      try {
        await sendEmail({
          to: rr.client_email,
          subject: "A gentle reminder about your Yugo review",
          template: "review-request-reminder",
          data: {
            clientName: rr.client_name,
            reviewUrl,
            reviewRedirectUrl,
          },
        });
      } catch (e) {
        errors.push(`reminder:${rr.id}:${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await supabase
      .from("review_requests")
      .update({
        status: "reminded",
        reminder_sent_at: new Date().toISOString(),
      })
      .eq("id", rr.id);
    reminded++;
  }

  return NextResponse.json({
    ok: true,
    sent,
    reminded,
    errors: errors.length > 0 ? errors : undefined,
  });
}
