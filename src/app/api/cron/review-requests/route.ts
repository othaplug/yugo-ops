import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken, signReviewToken } from "@/lib/track-token";
import { getTrackMoveSlug } from "@/lib/move-code";
import { isReviewOptedOut } from "@/lib/review/opt-out";

/**
 * Unified post-move review cadence. One review_requests row per completed move
 * drives three touches, and the public star tap is the gate (4-5 to Google,
 * 1-3 to the private form + admin alert):
 *
 *   Touch 1  scheduled_send_at (~3h)  SMS with the tap-gate link, or email if no phone
 *   Touch 2  reminder_send_at (~day 3) email, embedded-star gate
 *   Touch 3  final_send_at (~day 6)    email, final gentle nudge, then STOP
 *
 * A client who has responded (clicked, or left any rating) or permanently opted
 * out gets no further touch. Runs frequently (every ~15 min) so the 3h SMS lands
 * on time. Retired: the old direct-to-Google email in /api/cron/post-move-reviews.
 */

type ReviewRow = {
  id: string;
  move_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  tier: string | null;
  status: string | null;
  client_rating: number | null;
  review_clicked: boolean | null;
  short_code: string | null;
  scheduled_send_at: string | null;
  reminder_send_at: string | null;
  final_send_at: string | null;
};

const emailTemplateForTier = (tier: string | null): string => {
  const t = (tier || "essential").toLowerCase();
  if (t === "estate") return "review-request-estate";
  if (t === "signature" || t === "premier") return "review-request-signature";
  return "review-request-essential";
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const nowIso = new Date().toISOString();

  const { data: configRows } = await admin
    .from("platform_config")
    .select("key, value")
    .in("key", ["auto_review_requests", "coordinator_name"]);
  const config: Record<string, string> = {};
  for (const r of configRows || []) config[r.key] = r.value;
  if (config.auto_review_requests !== "true" && config.auto_review_requests !== "1") {
    return NextResponse.json({ ok: true, skipped: "feature disabled" });
  }
  const coordinatorName = config.coordinator_name || null;

  // Rows with a touch due now: pending→t1, sent→t2, reminded→t3. Three typed
  // queries rather than an or(and(...)) string so ISO timestamps filter cleanly.
  const cols =
    "id, move_id, client_name, client_email, client_phone, tier, status, client_rating, review_clicked, short_code, scheduled_send_at, reminder_send_at, final_send_at";
  const [t1, t2, t3] = await Promise.all([
    admin.from("review_requests").select(cols).eq("status", "pending").lte("scheduled_send_at", nowIso).limit(50),
    admin.from("review_requests").select(cols).eq("status", "sent").lte("reminder_send_at", nowIso).limit(50),
    admin.from("review_requests").select(cols).eq("status", "reminded").lte("final_send_at", nowIso).limit(50),
  ]);
  const due = [...(t1.data ?? []), ...(t2.data ?? []), ...(t3.data ?? [])];

  const results = { sms: 0, email: 0, stopped: 0, suppressed: 0, errors: [] as string[] };

  const buildLinks = (rr: ReviewRow) => {
    const token = signReviewToken(rr.id);
    const t = encodeURIComponent(token);
    return {
      reviewUrl: `${baseUrl}/review?token=${t}`,
      reviewRedirectUrl: `${baseUrl}/api/review/redirect?token=${t}`,
      optOutUrl: `${baseUrl}/api/review/opt-out?token=${t}`,
    };
  };

  const trackingUrlFor = async (rr: ReviewRow): Promise<string> => {
    if (!rr.move_id) return baseUrl;
    const { data: move } = await admin
      .from("moves")
      .select("move_code, id")
      .eq("id", rr.move_id)
      .maybeSingle();
    const slug = move ? getTrackMoveSlug({ move_code: move.move_code, id: move.id }) : rr.move_id;
    const token = signTrackToken("move", rr.move_id);
    return slug ? `${baseUrl}/track/move/${slug}?token=${token}` : baseUrl;
  };

  const sendReviewEmail = async (rr: ReviewRow, template: string) => {
    if (!rr.client_email) return false;
    const { reviewUrl, reviewRedirectUrl, optOutUrl } = buildLinks(rr);
    const trackingUrl = await trackingUrlFor(rr);
    const firstName = (rr.client_name || "").trim().split(/\s+/)[0] || "";
    const subject =
      template === "review-request-reminder"
        ? `One last note, ${firstName || "from Yugo"}`
        : (rr.tier || "").toLowerCase() === "estate"
          ? `${firstName}, it was our privilege — how did we do?`
          : `How was your Yugo move${firstName ? `, ${firstName}` : ""}?`;
    // The four review templates share a superset data shape; the discriminated
    // union can't narrow on a runtime-chosen template, so cast the whole option.
    await sendEmail({
      to: rr.client_email,
      subject,
      template,
      data: {
        clientName: rr.client_name || "",
        tier: rr.tier,
        reviewUrl,
        reviewRedirectUrl,
        referralUrl: null,
        trackingUrl,
        coordinatorName,
        optOutUrl,
      },
    } as Parameters<typeof sendEmail>[0]);
    return true;
  };

  for (const rr of (due as ReviewRow[]) || []) {
    // Permanent opt-out wins over any pending touch.
    if (await isReviewOptedOut(admin, { email: rr.client_email, phone: rr.client_phone })) {
      await admin.from("review_requests").update({ status: "cancelled" }).eq("id", rr.id);
      results.suppressed++;
      continue;
    }

    // Responded (clicked through, or left any rating) → stop the sequence.
    if (rr.review_clicked === true || rr.client_rating != null) {
      await admin.from("review_requests").update({ status: "done" }).eq("id", rr.id);
      results.stopped++;
      continue;
    }

    try {
      if (rr.status === "pending") {
        // Touch 1: SMS if we have a phone, else fall back to the email.
        if (rr.client_phone && rr.client_phone.trim()) {
          const { data: claimed } = await admin
            .from("review_requests")
            .update({ status: "sent", sms_sent_at: nowIso })
            .eq("id", rr.id)
            .eq("status", "pending")
            .select("id");
          if (!claimed?.length) continue;
          const { reviewUrl } = buildLinks(rr);
          const link = rr.short_code ? `${baseUrl}/r/${rr.short_code}` : reviewUrl;
          const firstName = (rr.client_name || "there").trim().split(/\s+/)[0] || "there";
          // Heartfelt, restrained, and organized: greeting, gratitude, reason,
          // then a clear call to action on its own line.
          const body = [
            `Hi ${firstName},`,
            `Thank you for trusting us with your home and the things that matter most to you. It was a privilege to move you, and it is a trust we hold with real care.`,
            `If we looked after you well, a moment to share your experience would mean the world to our team and help another family feel this same peace of mind.`,
            `Please click this link to leave us a thoughtful review: ${link}`,
            `With gratitude,\nThe Yugo Team`,
          ].join("\n\n");
          const sms = await sendSMS(rr.client_phone.replace(/\s/g, ""), body);
          if (sms.success) results.sms++;
          else results.errors.push(`t1-sms:${rr.id}:${sms.error}`);
        } else {
          const { data: claimed } = await admin
            .from("review_requests")
            .update({ status: "sent", email_sent_at: nowIso })
            .eq("id", rr.id)
            .eq("status", "pending")
            .select("id");
          if (!claimed?.length) continue;
          if (await sendReviewEmail(rr, emailTemplateForTier(rr.tier))) results.email++;
        }
      } else if (rr.status === "sent") {
        // Touch 2: email (embedded-star gate). Prefer email; only reachable-by-SMS
        // clients with no email are skipped forward.
        const { data: claimed } = await admin
          .from("review_requests")
          .update({ status: "reminded", reminder_sent_at: nowIso })
          .eq("id", rr.id)
          .eq("status", "sent")
          .select("id");
        if (!claimed?.length) continue;
        if (await sendReviewEmail(rr, emailTemplateForTier(rr.tier))) results.email++;
      } else if (rr.status === "reminded") {
        // Touch 3: final email, different framing. Email-only so we never text
        // a third time. Then the row is terminal.
        const { data: claimed } = await admin
          .from("review_requests")
          .update({ status: "final", final_sent_at: nowIso })
          .eq("id", rr.id)
          .eq("status", "reminded")
          .select("id");
        if (!claimed?.length) continue;
        if (await sendReviewEmail(rr, "review-request-reminder")) results.email++;
      }
    } catch (e) {
      results.errors.push(`${rr.id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
