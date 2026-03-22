import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { runQuoteFollowupCronJob } from "@/lib/quote-followups/cron-job";

/**
 * Vercel Cron: runs daily at 11 AM EST (16:00 UTC).
 * Automated nurture sequence for unbooked quotes.
 *
 * Rule 1: sent + 24hr, not viewed  → reminder email
 * Rule 2: viewed + 48hr, not booked → urgency/smart email + HubSpot task
 * Rule 3: viewed + 5 days, not booked → final follow-up + HubSpot task
 * Rule 4: expired quotes → mark as expired
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const cfg = await getFeatureConfig(["auto_followup_enabled", "followup_max_attempts"]);
  const followupEnabled = cfg.auto_followup_enabled === "true";
  const maxAttempts = Math.max(0, parseInt(cfg.followup_max_attempts, 10) || 3);

  const results = {
    followup1: 0,
    followup2: 0,
    followup3: 0,
    expired: 0,
    errors: [] as string[],
    skipped: !followupEnabled,
  };

  const statusNotAcceptedOrExpired = ["draft", "sent", "viewed", "declined"];

  if (!followupEnabled) {
    const { data: expiredQuotes } = await supabase
      .from("quotes")
      .select("quote_id")
      .lt("expires_at", now.toISOString())
      .in("status", statusNotAcceptedOrExpired);

    if (expiredQuotes && expiredQuotes.length > 0) {
      const expiredIds = expiredQuotes.map((q) => q.quote_id);
      await supabase
        .from("quotes")
        .update({ status: "expired", updated_at: now.toISOString() })
        .in("quote_id", expiredIds);
      results.expired = expiredIds.length;
    }

    return NextResponse.json({ ok: true, ...results });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  if (dryRun) {
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: rule1Count } = await supabase
      .from("quotes")
      .select("quote_id", { count: "exact", head: true })
      .eq("status", "sent")
      .lt("sent_at", cutoff24h)
      .is("viewed_at", null)
      .is("followup_1_sent", null);
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { count: rule2Count } =
      maxAttempts >= 2
        ? await supabase
            .from("quotes")
            .select("quote_id", { count: "exact", head: true })
            .eq("status", "viewed")
            .lt("viewed_at", cutoff48h)
            .is("accepted_at", null)
            .is("followup_2_sent", null)
        : { count: 0 };
    const cutoff5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { count: rule3Count } =
      maxAttempts >= 3
        ? await supabase
            .from("quotes")
            .select("quote_id", { count: "exact", head: true })
            .in("status", ["viewed", "sent"])
            .lt("viewed_at", cutoff5d)
            .is("accepted_at", null)
            .is("followup_3_sent", null)
        : { count: 0 };
    return NextResponse.json({
      ok: true,
      dry_run: true,
      auto_followup_enabled: followupEnabled,
      followup_max_attempts: maxAttempts,
      would_send: { followup1: rule1Count ?? 0, followup2: rule2Count ?? 0, followup3: rule3Count ?? 0 },
    });
  }

  const job = await runQuoteFollowupCronJob();

  return NextResponse.json({
    ok: true,
    followup1: job.followup1,
    followup2: job.followup2,
    followup3: job.followup3,
    expired: job.expired,
    errors: job.errors.length,
  });
}
