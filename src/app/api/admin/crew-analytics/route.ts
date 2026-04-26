import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getTodayString, getLocalDateString } from "@/lib/business-timezone";
import { filterCompletedSessionsWithResolvableJobs } from "@/lib/crew/analytics-countable-sessions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const url = new URL(req.url);
  const today = getTodayString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const from = url.searchParams.get("from") || getLocalDateString(thirtyDaysAgo);
  const to = url.searchParams.get("to") || today;

  const admin = createAdminClient();

  const [crewsRes, signOffsRes, sessionsRes] = await Promise.all([
    admin.from("crews").select("id, name, members").order("name"),
    admin
      .from("client_sign_offs")
      .select("job_id, job_type, satisfaction_rating, signed_at")
      .gte("signed_at", from)
      .lte("signed_at", to + "T23:59:59.999Z"),
    admin
      .from("tracking_sessions")
      .select("id, job_id, job_type, team_id, status, started_at, checkpoints, completed_at")
      .gte("started_at", from)
      .lte("started_at", to + "T23:59:59.999Z"),
  ]);

  const crews = crewsRes.data || [];
  const signOffs = signOffsRes.data || [];
  const sessions = sessionsRes.data || [];

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const countableSessions = await filterCompletedSessionsWithResolvableJobs(admin, completedSessions);

  const moveIds = countableSessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = countableSessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const [podsMoveRes, podsDeliveryRes] = await Promise.all([
    moveIds.length > 0
      ? admin.from("proof_of_delivery").select("move_id, satisfaction_rating").in("move_id", moveIds).not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
    deliveryIds.length > 0
      ? admin.from("proof_of_delivery").select("delivery_id, satisfaction_rating").in("delivery_id", deliveryIds).not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  const signOffByJob = new Map<string, { rating: number | null }>();
  signOffs.forEach((s) => signOffByJob.set(`${s.job_id}:${s.job_type}`, { rating: s.satisfaction_rating }));

  const podRatingByMove = new Map<string, number>();
  (podsMoveRes.data || []).forEach((p) => {
    if (p.move_id && p.satisfaction_rating != null) podRatingByMove.set(p.move_id, p.satisfaction_rating);
  });
  const podRatingByDelivery = new Map<string, number>();
  (podsDeliveryRes.data || []).forEach((p) => {
    if (p.delivery_id && p.satisfaction_rating != null) podRatingByDelivery.set(p.delivery_id, p.satisfaction_rating);
  });

  function getRating(jobId: string, jobType: string): number | null {
    const so = signOffByJob.get(`${jobId}:${jobType}`);
    if (so?.rating != null) return so.rating;
    if (jobType === "move") return podRatingByMove.get(jobId) ?? null;
    return podRatingByDelivery.get(jobId) ?? null;
  }
  const byCrew = new Map<string, { jobs: number; signOffs: number; totalDuration: number; ratings: number[] }>();

  crews.forEach((c) => {
    byCrew.set(c.id, { jobs: 0, signOffs: 0, totalDuration: 0, ratings: [] });
  });

  countableSessions.forEach((s) => {
    const stats = byCrew.get(s.team_id);
    if (!stats) return;
    stats.jobs += 1;
    const so = signOffByJob.get(`${s.job_id}:${s.job_type}`);
    if (so) stats.signOffs += 1;
    const rating = getRating(s.job_id, s.job_type);
    if (rating != null) stats.ratings.push(rating);
    const start = s.started_at ? new Date(s.started_at).getTime() : 0;
    const end = (s.checkpoints as { timestamp?: string }[])?.[(s.checkpoints as unknown[]).length - 1];
    const endTime =
      end && typeof end === "object" && "timestamp" in end
        ? new Date((end as { timestamp: string }).timestamp).getTime()
        : s.completed_at
          ? new Date(s.completed_at).getTime()
          : Date.now();
    stats.totalDuration += Math.round((endTime - start) / 60000);
  });

  const analytics = crews.map((c) => {
    const stats = byCrew.get(c.id) || { jobs: 0, signOffs: 0, totalDuration: 0, ratings: [] };
    const avgSatisfaction =
      stats.ratings.length > 0
        ? Math.round((stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length) * 10) / 10
        : null;
    const signOffRate = stats.jobs > 0 ? Math.round((stats.signOffs / stats.jobs) * 100) : 0;
    const avgDuration = stats.jobs > 0 ? Math.round(stats.totalDuration / stats.jobs) : 0;
    return {
      id: c.id,
      name: c.name || "Unnamed",
      members: (c.members as string[]) || [],
      jobsCompleted: stats.jobs,
      signOffs: stats.signOffs,
      signOffRate,
      avgSatisfaction,
      avgDuration,
    };
  });

  return NextResponse.json({ analytics, from, to });
}
