import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { runQuoteFollowupCronJob } from "@/lib/quote-followups/engine";

/**
 * POST — run the same follow-up + expired batch as cron (ignores auto_followup_enabled).
 * Staff only.
 */
export async function POST() {
  const { error } = await requireStaff();
  if (error) return error;

  try {
    const job = await runQuoteFollowupCronJob();
    const emailsSent = job.followup1 + job.followup2 + job.followup3;
    return NextResponse.json({
      ok: true,
      emailsSent,
      followup1: job.followup1,
      followup2: job.followup2,
      followup3: job.followup3,
      expired: job.expired,
      coldMarked: job.coldMarked,
      errors: job.errors,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Send failed" },
      { status: 500 },
    );
  }
}
