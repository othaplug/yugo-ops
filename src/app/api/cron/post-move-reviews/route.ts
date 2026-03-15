import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import {
  internalLowSatAlertEmail,
  postMovePerksEmail,
  moveAnniversaryEmail,
} from "@/lib/email/lifecycle-templates";

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

  // ── VIP / lifetime value update (for each completed move) ───────────────────
  // Referral codes are created at move completion (checkpoint, signoff, notify-complete)
  // and on first dashboard load (perks-referral API). This cron no longer creates them.
  for (const move of moves) {
    if (!move.client_email) continue;
    try {
      // Auto-VIP check: estate tier OR lifetime value > $5,000
      const { data: allMoves } = await supabase
        .from("moves")
        .select("amount, tier_selected")
        .eq("client_email", move.client_email)
        .eq("status", "completed");

      const ltv = (allMoves || []).reduce((s, m) => s + (Number(m.amount) || 0), 0);
      const isEstate = move.tier_selected === "estate";

      if (isEstate || ltv > 5000) {
        await supabase
          .from("contacts")
          .update({ vip_status: true, lifetime_value: ltv })
          .eq("email", move.client_email);
      } else {
        // Still update lifetime_value even if not VIP
        await supabase
          .from("contacts")
          .update({ lifetime_value: ltv })
          .eq("email", move.client_email);
      }
    } catch {
      // Non-critical — don't block review processing
    }
  }

  // ── 72hr Perks Email ─────────────────────────────────────────────────────────
  const ago72 = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const ago96 = new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString();

  const { data: perksMoves } = await supabase
    .from("moves")
    .select("id, move_code, client_name, client_email, scheduled_date, from_address, to_address, completed_at")
    .eq("status", "completed")
    .lt("completed_at", ago72)
    .gt("completed_at", ago96)
    .is("perks_email_sent", null);

  const { data: activePerks } = await supabase
    .from("partner_perks")
    .select("title, description, offer_type, discount_value, redemption_code, redemption_url")
    .eq("is_active", true)
    .or(`valid_until.is.null,valid_until.gte.${now.toISOString().split("T")[0]}`)
    .order("display_order", { ascending: true })
    .limit(4);

  const perksEmailsSent: number[] = [0];

  for (const move of perksMoves ?? []) {
    if (!move.client_email) continue;
    try {
      const trackToken = signTrackToken("move", move.id);
      const trackingUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${trackToken}`;

      const { data: ref } = await supabase
        .from("client_referrals")
        .select("referral_code, referrer_credit, referred_discount")
        .eq("referrer_email", move.client_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const html = postMovePerksEmail({
        clientName: move.client_name || "",
        moveCode: move.move_code || move.id,
        referralCode: ref?.referral_code ?? null,
        referredDiscount: ref?.referred_discount ?? 75,
        referrerCredit: ref?.referrer_credit ?? 75,
        trackingUrl,
        activePerks: activePerks ?? [],
      });

      await sendEmail({
        to: move.client_email,
        subject: `Your Yugo perks are waiting — ${move.move_code}`,
        html,
      });

      await supabase
        .from("moves")
        .update({ perks_email_sent: now.toISOString() })
        .eq("id", move.id);

      perksEmailsSent[0]++;
    } catch (err) {
      results.errors.push(`perks:${move.move_code}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 365-day Anniversary Email ─────────────────────────────────────────────────
  const ago365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const ago366 = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000).toISOString();

  const { data: anniversaryMoves } = await supabase
    .from("moves")
    .select("id, move_code, client_name, client_email, scheduled_date, from_address, to_address, completed_at")
    .eq("status", "completed")
    .lt("completed_at", ago365)
    .gt("completed_at", ago366)
    .is("anniversary_email_sent", null);

  const anniversaryEmailsSent: number[] = [0];

  for (const move of anniversaryMoves ?? []) {
    if (!move.client_email) continue;
    try {
      const { data: ref } = await supabase
        .from("client_referrals")
        .select("referral_code, referred_discount")
        .eq("referrer_email", move.client_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const html = moveAnniversaryEmail({
        clientName: move.client_name || "",
        moveCode: move.move_code || move.id,
        moveDate: move.scheduled_date ?? null,
        fromAddress: move.from_address ?? null,
        toAddress: move.to_address ?? null,
        referralCode: ref?.referral_code ?? null,
        referredDiscount: ref?.referred_discount ?? 75,
      });

      await sendEmail({
        to: move.client_email,
        subject: `One year since your move — happy move-iversary! 🎉`,
        html,
      });

      await supabase
        .from("moves")
        .update({ anniversary_email_sent: now.toISOString() })
        .eq("id", move.id);

      anniversaryEmailsSent[0]++;
    } catch (err) {
      results.errors.push(`anniversary:${move.move_code}:${err instanceof Error ? err.message : String(err)}`);
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
    perksEmailsSent: perksEmailsSent[0],
    anniversaryEmailsSent: anniversaryEmailsSent[0],
    errors: results.errors.length,
  });
}
