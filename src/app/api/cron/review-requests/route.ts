import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signReviewToken } from "@/lib/track-token";
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

  // ── Activate held requests whose damage claim is now resolved ──
  // A client with an open claim is held; once the claim clears we start the
  // cadence clocked from NOW (the resolution), not the original completion.
  let activated = 0;
  const isClaimOpen = (s: string | null | undefined) => {
    const v = String(s ?? "").toLowerCase().trim();
    return v !== "resolved" && v !== "closed" && v !== "denied" && v !== "cancelled";
  };
  const { data: heldRows } = await admin
    .from("review_requests")
    .select("id, move_id")
    .eq("status", "held")
    .limit(50);
  for (const h of heldRows ?? []) {
    if (!h.move_id) continue;
    const { data: claims } = await admin.from("claims").select("status").eq("move_id", h.move_id);
    if ((claims ?? []).some((c) => isClaimOpen((c as { status?: string | null }).status))) continue;
    const t = Date.now();
    const { data: flipped } = await admin
      .from("review_requests")
      .update({
        status: "pending",
        scheduled_send_at: new Date(t + 3 * 60 * 60 * 1000).toISOString(),
        reminder_send_at: new Date(t + 72 * 60 * 60 * 1000).toISOString(),
        final_send_at: new Date(t + 6 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", h.id)
      .eq("status", "held")
      .select("id");
    if (flipped?.length) activated++;
  }

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

  // The one link every touch uses: /r/<code> logs the click and 302s straight to
  // Google. No star page, no gate. Falls back to a signed /review only if a row
  // somehow has no short code.
  const googleLink = (rr: ReviewRow): string =>
    rr.short_code
      ? `${baseUrl}/r/${rr.short_code}`
      : `${baseUrl}/review?token=${encodeURIComponent(signReviewToken(rr.id))}`;
  const optOutUrlFor = (rr: ReviewRow): string =>
    `${baseUrl}/api/review/opt-out?token=${encodeURIComponent(signReviewToken(rr.id))}`;

  const firstNameOf = (rr: ReviewRow) => (rr.client_name || "").trim().split(/\s+/)[0] || "";

  // SMS copy — the ask goes to everyone, no condition, Google named twice, reply
  // line for private feedback. No em dashes, no exclamation marks.
  const smsBody = (rr: ReviewRow): string => {
    const first = firstNameOf(rr) || "there";
    return [
      `Hi ${first},`,
      `Thank you for trusting us with your home and the things that matter most to you. It was a privilege to move you, and it is a trust we hold with real care.`,
      `A moment to share your experience on Google would mean the world to our team, and help another family feel this same peace of mind.`,
      `Please click this link to leave your review on Google: ${googleLink(rr)}`,
      `If anything could have been better, simply reply to this message. It comes straight to us.`,
      `With gratitude,\nThe Yugo Team`,
    ].join("\n\n");
  };

  const sendReviewSms = async (rr: ReviewRow): Promise<boolean> => {
    if (!rr.client_phone || !rr.client_phone.trim()) return false;
    const sms = await sendSMS(rr.client_phone.replace(/\s/g, ""), smsBody(rr));
    if (sms.success) { results.sms++; return true; }
    results.errors.push(`sms:${rr.id}:${sms.error}`);
    return false;
  };

  const sendReviewEmail = async (rr: ReviewRow): Promise<boolean> => {
    if (!rr.client_email) return false;
    const first = firstNameOf(rr);
    await sendEmail({
      to: rr.client_email,
      subject: `Thank you${first ? `, ${first}` : ""}`,
      template: "review-request-google",
      data: {
        clientName: rr.client_name || "",
        reviewUrl: googleLink(rr),
        optOutUrl: optOutUrlFor(rr),
        coordinatorName,
      },
    } as Parameters<typeof sendEmail>[0]);
    results.email++;
    return true;
  };

  for (const rr of (due as ReviewRow[]) || []) {
    // Permanent opt-out wins over any pending touch.
    if (await isReviewOptedOut(admin, { email: rr.client_email, phone: rr.client_phone })) {
      await admin.from("review_requests").update({ status: "cancelled" }).eq("id", rr.id);
      results.suppressed++;
      continue;
    }

    // Stop the moment the client acts: clicked the Google link, or replied
    // (an SMS/email reply sets review_clicked via the inbound handler). No star
    // rating exists any more, so there is nothing else to gate on.
    if (rr.review_clicked === true) {
      await admin.from("review_requests").update({ status: "done" }).eq("id", rr.id);
      results.stopped++;
      continue;
    }

    try {
      if (rr.status === "pending") {
        // Touch 1 (~3h): SMS, or email when there is no phone.
        const { data: claimed } = await admin
          .from("review_requests")
          .update({ status: "sent", sms_sent_at: nowIso })
          .eq("id", rr.id)
          .eq("status", "pending")
          .select("id");
        if (!claimed?.length) continue;
        if (rr.client_phone && rr.client_phone.trim()) await sendReviewSms(rr);
        else await sendReviewEmail(rr);
      } else if (rr.status === "sent") {
        // Touch 2 (~72h): SMS AND email.
        const { data: claimed } = await admin
          .from("review_requests")
          .update({ status: "reminded", reminder_sent_at: nowIso })
          .eq("id", rr.id)
          .eq("status", "sent")
          .select("id");
        if (!claimed?.length) continue;
        await sendReviewSms(rr);
        await sendReviewEmail(rr);
      } else if (rr.status === "reminded") {
        // Touch 3 (~day 6): final email, then the row is terminal.
        const { data: claimed } = await admin
          .from("review_requests")
          .update({ status: "final", final_sent_at: nowIso })
          .eq("id", rr.id)
          .eq("status", "reminded")
          .select("id");
        if (!claimed?.length) continue;
        await sendReviewEmail(rr);
      }
    } catch (e) {
      results.errors.push(`${rr.id}:${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, activated, ...results });
}
