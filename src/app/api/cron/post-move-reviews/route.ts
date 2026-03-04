import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { internalLowSatAlertEmail } from "@/lib/email/lifecycle-templates";

const GOOGLE_REVIEW_URL =
  process.env.GOOGLE_REVIEW_URL || "https://g.page/r/yugo-moving/review";

/**
 * Vercel Cron: runs daily at 10 AM EST.
 * Sends review requests 24-48 hours after move completion.
 * Routes to Google review or internal follow-up based on NPS score.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();

  const ago24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const ago48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: moves } = await supabase
    .from("moves")
    .select(`
      id, move_code, client_name, client_email, client_phone,
      scheduled_date, from_address, to_address, completed_at,
      nps_score, hubspot_deal_id, amount, service_type,
      tier_selected
    `)
    .eq("status", "completed")
    .lt("completed_at", ago24)
    .gt("completed_at", ago48)
    .is("review_request_sent", null);

  if (!moves || moves.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const { data: coordConfig } = await supabase
    .from("platform_config")
    .select("key, value")
    .in("key", ["coordinator_name", "coordinator_phone", "coordinator_email"]);

  const coordinatorName = coordConfig?.find((c) => c.key === "coordinator_name")?.value || null;
  const coordinatorPhone = coordConfig?.find((c) => c.key === "coordinator_phone")?.value || null;
  const coordinatorEmail = coordConfig?.find((c) => c.key === "coordinator_email")?.value || null;

  const results = { reviewsSent: 0, followUpsSent: 0, dealsClosed: 0, errors: [] as string[] };

  for (const move of moves) {
    if (!move.client_email) continue;

    const trackToken = signTrackToken("move", move.id);
    const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;
    const referralUrl =
      move.service_type === "local_move"
        ? `${baseUrl}/referral?ref=${encodeURIComponent(move.move_code || move.id)}`
        : null;

    const score = move.nps_score as number | null;

    try {
      if (score !== null && score < 4) {
        /* ── Low satisfaction: send internal alert + client follow-up ── */

        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
        if (adminEmail) {
          const alertHtml = internalLowSatAlertEmail({
            clientName: move.client_name || "",
            clientEmail: move.client_email,
            clientPhone: move.client_phone || "",
            moveCode: move.move_code || move.id,
            npsScore: score,
            moveDate: move.scheduled_date,
          });

          await sendEmail({
            to: adminEmail,
            subject: `Low satisfaction: ${move.client_name} — ${move.move_code} (${score}/5)`,
            html: alertHtml,
          });
        }

        await sendEmail({
          to: move.client_email,
          subject: `We want to make it right — ${move.move_code}`,
          template: "low-satisfaction",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            coordinatorName,
            coordinatorPhone,
            coordinatorEmail,
            trackingUrl,
          },
        });

        results.followUpsSent++;
      } else {
        /* ── Good score (>= 4) or no score: send review request ── */

        await sendEmail({
          to: move.client_email,
          subject: `How was your move? — ${move.move_code}`,
          template: "review-request",
          data: {
            clientName: move.client_name || "",
            moveCode: move.move_code || move.id,
            googleReviewUrl: GOOGLE_REVIEW_URL,
            referralUrl,
            trackingUrl,
          },
        });

        results.reviewsSent++;
      }

      await supabase
        .from("moves")
        .update({ review_request_sent: new Date().toISOString() })
        .eq("id", move.id);
    } catch (err) {
      results.errors.push(`review:${move.move_code}:${err instanceof Error ? err.message : String(err)}`);
    }

    /* ── Close HubSpot deal if not already ── */
    if (move.hubspot_deal_id) {
      try {
        await syncDealStage(move.hubspot_deal_id, "completed");

        const token = process.env.HUBSPOT_ACCESS_TOKEN;
        if (token) {
          await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/${move.hubspot_deal_id}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  closedate: move.completed_at || new Date().toISOString(),
                  amount: move.amount ? String(move.amount) : undefined,
                },
              }),
            },
          );
          results.dealsClosed++;
        }
      } catch {
        /* HubSpot failures don't block the loop */
      }
    }
  }

  if (results.errors.length > 0) {
    await supabase.from("webhook_logs").insert({
      source: "cron_post_move_reviews",
      event_type: "partial_failure",
      payload: results,
      status: "error",
      error: results.errors.join("; ").slice(0, 500),
    }).then(() => {});
  }

  return NextResponse.json({
    ok: true,
    processed: moves.length,
    reviewsSent: results.reviewsSent,
    followUpsSent: results.followUpsSent,
    dealsClosed: results.dealsClosed,
    errors: results.errors.length,
  });
}
