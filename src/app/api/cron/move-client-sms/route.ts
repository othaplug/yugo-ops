import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { isTerminalMoveStatus } from "@/lib/moves/job-terminal";
import { resolveGoogleReviewUrl } from "@/lib/google-review-url";

const POST_MOVE_KINDS = new Set(["post_move_review", "post_move_recovery"]);
const DEFAULT_SUPPORT_PHONE = "(647) 370-4525";

/**
 * Vercel Cron: send due client texts (DB-scheduled, no timers). Handles both
 * mid-move check-ins (en_route / long_unload) and the timely post-move texts
 * (post_move_review / post_move_recovery) queued ~1h after completion.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cfg = await getFeatureConfig(["sms_eta_enabled"]);
  const smsEnabled = cfg.sms_eta_enabled === "true";
  const now = new Date().toISOString();

  // Pulled lazily only when a post-move row is in the batch.
  let postMoveConfig: {
    googleReviewUrl: string;
    coordinatorName: string | null;
    supportPhone: string;
  } | null = null;
  const getPostMoveConfig = async () => {
    if (postMoveConfig) return postMoveConfig;
    const { data: rows } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", ["google_review_url", "coordinator_name", "coordinator_phone"]);
    const map: Record<string, string> = {};
    for (const r of rows || []) map[r.key] = r.value;
    postMoveConfig = {
      googleReviewUrl: resolveGoogleReviewUrl(map.google_review_url),
      coordinatorName: (map.coordinator_name || "").trim() || null,
      supportPhone: (map.coordinator_phone || "").trim() || DEFAULT_SUPPORT_PHONE,
    };
    return postMoveConfig;
  };

  const { data: due, error: qErr } = await admin
    .from("scheduled_move_client_sms")
    .select("id, move_id, kind")
    .eq("status", "pending")
    .lte("send_at", now)
    .limit(40);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: [] as string[] };

  for (const row of due || []) {
    results.processed++;
    const isPostMove = POST_MOVE_KINDS.has(row.kind as string);

    const { data: move } = await admin
      .from("moves")
      .select("id, client_name, client_phone, status")
      .eq("id", row.move_id)
      .maybeSingle();

    if (!move?.client_phone?.trim()) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "no_phone" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    // Mid-move texts are moot once the job is terminal. Post-move texts are the
    // opposite — they are SUPPOSED to fire after the move is done, so the
    // terminal guard must not apply to them.
    if (!isPostMove && isTerminalMoveStatus(move.status as string)) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "move_finished" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    const firstName = (move.client_name || "there").trim().split(/\s+/)[0] || "there";

    let body: string;
    if (isPostMove) {
      const pm = await getPostMoveConfig();
      if (row.kind === "post_move_recovery") {
        // Luxury service recovery: personal ownership, a real human + direct
        // line, no review ask. Reaching out fast is the whole point.
        const fromLine = pm.coordinatorName
          ? `this is ${pm.coordinatorName} at Yugo`
          : `this is the team at Yugo`;
        body = [
          `Hi ${firstName}, ${fromLine}.`,
          `Thank you for trusting us with your move today. It's clear we fell short of the standard you deserve, and I'd like to personally make it right.`,
          `I'll be reaching out shortly — or call us anytime at ${pm.supportPhone}. Putting this right matters to us.`,
        ].join("\n\n");
      } else {
        // 4–5★ at sign-off → thank-you + Google review (straight to Google,
        // since they already rated us during sign-off).
        body = [
          `Hi ${firstName},`,
          `Thank you for letting Yugo care for your move — it was our privilege.`,
          `If you have a moment, a quick Google review would mean a great deal to our team:`,
          pm.googleReviewUrl,
        ].join("\n\n");
      }
    } else {
      body =
        row.kind === "en_route_checkin"
          ? [
              `Hi ${firstName},`,
              `Your belongings are on the way to your new home and your crew is making excellent progress.`,
              `If you need anything at all, reply here or call us at ${DEFAULT_SUPPORT_PHONE}. We are with you every step.`,
            ].join("\n\n")
          : [
              `Hi ${firstName},`,
              `Your crew has arrived at your new home and is beginning to unload. Almost there.`,
              `If you have any requests or need anything arranged, just let us know. We want everything to be just right.`,
            ].join("\n\n");
    }

    // ETA toggle only governs the mid-move check-ins. Post-move review texts
    // were already gated on `auto_review_requests` at schedule time, and
    // recovery texts must always send.
    if (!isPostMove && !smsEnabled) {
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: "sms_eta_disabled" })
        .eq("id", row.id);
      results.skipped++;
      continue;
    }

    try {
      const sms = await sendSMS(move.client_phone.replace(/\s/g, ""), body);
      await admin
        .from("scheduled_move_client_sms")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: sms.success ? null : (sms.error ?? "send_failed"),
        })
        .eq("id", row.id);
      if (sms.success) results.sent++;
      else results.errors.push(`${row.id}: ${sms.error}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_error";
      results.errors.push(`${row.id}: ${msg}`);
      await admin
        .from("scheduled_move_client_sms")
        .update({ status: "skipped", last_error: msg.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, ...results });
}
