import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stale tracking-session sweeper.
 *
 * A crew normally ends a session by finishing the job (sign-off) or, on a
 * multi-day move, by marking the project day complete (which closes the
 * session). If neither happens — the crew forgets, or the app is closed — the
 * session stays `is_active = true` and its timer/GPS runs indefinitely (the
 * "10h 52m and climbing overnight" case). This backstop closes any session
 * that has been active well past a full work day so the timer never runs away.
 *
 * Threshold is generous (default 18h) so it never trips on a legitimately long
 * Estate day; it only catches genuinely forgotten sessions. Belt-and-suspenders
 * to the day-complete + sign-off paths, which remain the primary close.
 */
const DEFAULT_MAX_ACTIVE_HOURS = 18;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const hoursParam = Number(url.searchParams.get("maxHours"));
  const maxHours =
    Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : DEFAULT_MAX_ACTIVE_HOURS;

  const db = createAdminClient();
  const cutoffIso = new Date(Date.now() - maxHours * 3600_000).toISOString();
  const nowIso = new Date().toISOString();

  // Active sessions whose most recent ACTIVITY (updated_at) is older than the
  // cutoff. This previously filtered on started_at, which force-closed a
  // session that had merely been RUNNING >18h even while it was still actively
  // pushing GPS. Filtering on updated_at (matching the crews-map sweeper) only
  // closes genuinely idle/forgotten sessions and leaves live ones alone.
  const { data: stale, error } = await db
    .from("tracking_sessions")
    .select("id, job_id, job_type, started_at, updated_at")
    .eq("is_active", true)
    .lt("updated_at", cutoffIso)
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let closed = 0;
  for (const s of stale ?? []) {
    const { error: upErr } = await db
      .from("tracking_sessions")
      .update({
        is_active: false,
        status: "completed",
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", s.id)
      .eq("is_active", true);
    if (!upErr) closed += 1;
  }

  return NextResponse.json({ ok: true, scanned: stale?.length ?? 0, closed, maxHours });
}
