"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Star,
  MusicNote,
  PaintBrush,
  Lightning,
  ShieldCheck,
  Medal,
  CurrencyDollar,
  Users,
  TrendUp,
  Coins,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

const BADGE_ICONS: Record<string, React.ReactNode> = {
  Trophy: <Trophy size={16} weight="fill" />,
  Star: <Star size={16} weight="fill" />,
  MusicNote: <MusicNote size={16} weight="fill" />,
  PaintBrush: <PaintBrush size={16} weight="fill" />,
  Lightning: <Lightning size={16} weight="fill" />,
  ShieldCheck: <ShieldCheck size={16} weight="fill" />,
  Medal: <Medal size={16} weight="fill" />,
};

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
}

interface TipRecord {
  id: string;
  client_name: string | null;
  amount: number;
  net_amount: number | null;
  charged_at: string;
}

interface TipSummary {
  totalEarned: number;
  avgTip: number;
  highestTip: number;
  count: number;
}

interface Stats {
  profile: { totalJobs: number; avgRating: number; damageIncidents: number; onTimeRate: number };
  thisMonth: { jobs: number; tips: number; avgRating: number | null; avgTipPerJob: number };
  badges: Badge[];
  leaderboard: {
    name: string;
    monthJobs: number;
    avgRating: number;
    monthTips: number;
    badges: string[];
  }[];
}

export default function CrewStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tipData, setTipData] = useState<{ tips: TipRecord[]; summary: TipSummary; monthlyBreakdown: { label: string; amount: number; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/crew/stats").then((r) => {
        if (r.status === 401) { router.replace("/crew/login"); return null; }
        return r.json();
      }),
      fetch("/api/crew/tips").then((r) => r.ok ? r.json() : null),
    ])
      .then(([statsData, tipsData]) => {
        if (statsData) setStats(statsData);
        if (tipsData) setTipData(tipsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const now = new Date();
  const monthLabel = now.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageContent>
    );
  }

  if (!stats) {
    return (
      <PageContent>
        <div className="text-center pt-12">
          <p className="text-[var(--tx3)]">Could not load stats. Try again later.</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <div className="max-w-[520px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--gold)]">Stats &amp; Leaderboard</p>
          <h1 className="font-hero text-[22px] font-bold text-[var(--tx)]">{monthLabel}</h1>
        </div>

        {/* This month KPIs */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} color="var(--gold)" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">Jobs</span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)]">{stats.thisMonth.jobs}</div>
            <div className="text-[10px] text-[var(--tx3)]">This month</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Star size={12} color="#F59E0B" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">Rating</span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)]">
              {stats.thisMonth.avgRating != null ? stats.thisMonth.avgRating.toFixed(1) : stats.profile.avgRating.toFixed(1)}
            </div>
            <div className="text-[10px] text-[var(--tx3)]">Avg this month</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <CurrencyDollar size={12} color="#22c55e" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">Tips</span>
            </div>
            <div className="text-[26px] font-bold text-[#22c55e]">${stats.thisMonth.tips}</div>
            <div className="text-[10px] text-[var(--tx3)]">${stats.thisMonth.avgTipPerJob} avg/job</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendUp size={12} color="var(--gold)" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">Career</span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)]">{stats.profile.totalJobs}</div>
            <div className="text-[10px] text-[var(--tx3)]">Total jobs</div>
          </div>
        </div>

        {/* Badges */}
        {stats.badges.length > 0 && (
          <div className="mb-6">
            <h2 className="admin-section-h2 text-[var(--tx2)] mb-3">
              Your Badges
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {stats.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-start gap-3 bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-3"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(201,169,98,0.12)", color: "var(--gold)" }}
                  >
                    {BADGE_ICONS[badge.icon] || <Medal size={16} weight="fill" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-[var(--tx)]">{badge.name}</p>
                    <p className="text-[10px] text-[var(--tx3)] leading-snug">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {stats.leaderboard.length > 0 && (
          <div>
            <h2 className="admin-section-h2 text-[var(--tx2)] mb-3">
              Leaderboard, {monthLabel}
            </h2>
            <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl overflow-hidden">
              {stats.leaderboard.map((entry, i) => (
                <div
                  key={entry.name || i}
                  className="flex items-center gap-3 px-4 py-3 border-b border-[var(--brd)]/20 last:border-0"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{
                      background: i === 0 ? "rgba(201,169,98,0.2)" : "var(--bg)",
                      color: i === 0 ? "var(--gold)" : "var(--tx3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--tx)] truncate">{entry.name}</p>
                    <p className="text-[10px] text-[var(--tx3)]">
                      {entry.monthJobs} job{entry.monthJobs !== 1 ? "s" : ""} · ${entry.monthTips} tips
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star size={12} color="#F59E0B" weight="fill" />
                    <span className="text-[12px] font-bold text-[var(--tx)]">
                      {entry.avgRating > 0 ? entry.avgRating.toFixed(1) : "-"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Tip History */}
        {tipData && tipData.summary.count > 0 && (
          <div className="mt-6">
            <h2 className="admin-section-h2 text-[var(--tx2)] mb-3">
              My Tips
            </h2>

            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Coins size={12} color="#22c55e" />
                </div>
                <div className="text-[18px] font-bold text-[#22c55e]">${Math.round(tipData.summary.totalEarned)}</div>
                <div className="text-[9px] text-[var(--tx3)]">Total Earned</div>
              </div>
              <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-3 text-center">
                <div className="text-[18px] font-bold text-[var(--tx)]">${Math.round(tipData.summary.avgTip)}</div>
                <div className="text-[9px] text-[var(--tx3)]">Avg / Job</div>
              </div>
              <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-3 text-center">
                <div className="text-[18px] font-bold text-[var(--gold)]">${Math.round(tipData.summary.highestTip)}</div>
                <div className="text-[9px] text-[var(--tx3)]">Best Tip</div>
              </div>
            </div>

            {/* Monthly bars */}
            {tipData.monthlyBreakdown.some((m) => m.amount > 0) && (
              <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4 mb-4">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]/60 mb-3">Monthly Tips</p>
                <div className="flex gap-2 items-end h-12">
                  {tipData.monthlyBreakdown.map((m) => {
                    const maxAmount = Math.max(...tipData.monthlyBreakdown.map((x) => x.amount), 1);
                    const height = Math.max(4, Math.round((m.amount / maxAmount) * 40));
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm"
                          style={{ height, background: m.amount > 0 ? "var(--gold)" : "var(--brd)", opacity: m.amount > 0 ? 1 : 0.3 }}
                          title={`${m.label}: $${Math.round(m.amount)}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-1">
                  {tipData.monthlyBreakdown.map((m) => (
                    <div key={m.label} className="flex-1 text-center">
                      <span className="text-[9px] text-[var(--tx3)]/50">{m.label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent tips list */}
            <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl overflow-hidden">
              <div className="px-4 py-2 border-b border-[var(--brd)]/20">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[var(--tx3)]/60">Recent Gratuities</p>
              </div>
              {tipData.tips.slice(0, 10).map((tip) => (
                <div
                  key={tip.id}
                  className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]/20 last:border-0"
                >
                  <div>
                    <p className="text-[12px] font-semibold text-[var(--tx)]">{tip.client_name || "Client"}</p>
                    <p className="text-[10px] text-[var(--tx3)]">
                      {new Date(tip.charged_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className="text-[14px] font-bold text-[#22c55e]">
                    +${Math.round(Number(tip.net_amount ?? tip.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContent>
  );
}
