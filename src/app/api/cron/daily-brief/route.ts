import { NextRequest, NextResponse } from "next/server";

/**
 * Daily brief — RETIRED.
 *
 * Was a 7 AM ET cron that emailed + SMS'd the coordinator a summary
 * (jobs today, revenue, alerts, expiring quotes). Operator asked to
 * remove both channels (the SMS was landing on the office number
 * every morning as "Yugo Daily Brief: 0 jobs today, $0 revenue" and
 * the email added noise without action).
 *
 * The Vercel cron entry has been removed from vercel.json so this
 * route is no longer called by the scheduler. The endpoint stays as a
 * 410 Gone so any lingering caller (manual cron, external monitor)
 * gets a clear signal instead of a silent 404.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      retired: true,
      message:
        "The daily-brief cron was retired. Both SMS and email channels are removed.",
    },
    { status: 410 },
  );
}
