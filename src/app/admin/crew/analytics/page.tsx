import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";
import Link from "next/link";

export default async function CrewAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const from = params.from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = params.to || today;

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

  const moveIds = sessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = sessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const signOffByJob = new Map<string, { rating: number | null }>();
  signOffs.forEach((s) => signOffByJob.set(`${s.job_id}:${s.job_type}`, { rating: s.satisfaction_rating }));

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const byCrew = new Map<
    string,
    { jobs: number; signOffs: number; totalDuration: number; ratings: number[] }
  >();

  crews.forEach((c) => {
    byCrew.set(c.id, { jobs: 0, signOffs: 0, totalDuration: 0, ratings: [] });
  });

  completedSessions.forEach((s) => {
    const stats = byCrew.get(s.team_id);
    if (!stats) return;
    stats.jobs += 1;
    const so = signOffByJob.get(`${s.job_id}:${s.job_type}`);
    if (so) {
      stats.signOffs += 1;
      if (so.rating != null) stats.ratings.push(so.rating);
    }
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

  const sorted = analytics.sort((a, b) => b.jobsCompleted - a.jobsCompleted);

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4 flex items-center justify-between">
        <BackButton label="Back" />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/crew"
            className="text-[12px] text-[var(--tx3)] hover:text-[var(--gold)]"
          >
            Tracking
          </Link>
          <span className="text-[var(--tx3)]">|</span>
          <span className="text-[12px] font-medium text-[var(--tx)]">
            {from} → {to}
          </span>
        </div>
      </div>
      <h1 className="font-hero text-[22px] font-bold text-[var(--tx)] mb-1">Crew Performance</h1>
      <p className="text-[13px] text-[var(--tx3)] mb-6">
        Satisfaction, sign-off rate, and average job duration by crew.
      </p>

      <div className="space-y-4">
        {sorted.map((a) => (
          <div
            key={a.id}
            className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-hero text-[15px] font-bold text-[var(--tx)]">{a.name}</h2>
                {a.members.length > 0 && (
                  <p className="text-[11px] text-[var(--tx3)] mt-0.5">{a.members.join(", ")}</p>
                )}
              </div>
              <span className="text-[11px] font-semibold text-[var(--tx3)]">
                {a.jobsCompleted} job{a.jobsCompleted !== 1 ? "s" : ""} completed
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-[12px]">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">
                  Avg satisfaction
                </div>
                <div className="text-[15px] font-bold text-[var(--tx)]">
                  {a.avgSatisfaction != null ? `${a.avgSatisfaction}/5` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">
                  Sign-off rate
                </div>
                <div className="text-[15px] font-bold text-[var(--tx)]">
                  {a.signOffRate}%
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)] mb-0.5">
                  Avg job time
                </div>
                <div className="text-[15px] font-bold text-[var(--tx)]">
                  {a.avgDuration > 0 ? `${a.avgDuration}m` : "—"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--bg)] p-8 text-center text-[var(--tx3)] text-[13px]">
          No crew activity in this date range.
        </div>
      )}
    </div>
  );
}
