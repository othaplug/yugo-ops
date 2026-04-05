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
  Clock,
  ShieldWarning,
  Ranking,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";

const FOREST = "#2C3E2D";
const WINE = "#5C1A33";
/** Tips / money emphasis — dark forest ink, not neon green */
const MONEY_INK = "#243524";

const CREW_EYEBROW =
  "block pl-0.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] mb-1 [font-family:var(--font-body)]";

const SECTION_EYEBROW =
  "block pl-0.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx2)] mb-2 [font-family:var(--font-body)]";

const STAT_TILE =
  "rounded-2xl bg-white/80 backdrop-blur-[2px] p-4 shadow-[0_2px_22px_rgba(44,62,45,0.07)]";

const PANEL_SOFT = "rounded-2xl bg-white/75 backdrop-blur-[2px] shadow-[0_2px_28px_rgba(44,62,45,0.06)]";

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
  teamName?: string;
  crewMemberName?: string;
  yourRankThisMonth?: number | null;
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
  const [tipData, setTipData] = useState<{
    tips: TipRecord[];
    summary: TipSummary;
    monthlyBreakdown: { label: string; amount: number; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/crew/stats").then((r) => {
        if (r.status === 401) {
          router.replace("/crew/login");
          return null;
        }
        return r.json();
      }),
      fetch("/api/crew/tips").then((r) => (r.ok ? r.json() : null)),
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

  const onTimeDisplay = (rate: number) => {
    if (rate <= 0) return "—";
    const pct = rate > 1 ? Math.round(rate) : Math.round(rate * 100);
    return `${pct}%`;
  };

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-[#5C1A33]/25 border-t-[#5C1A33] rounded-full animate-spin" />
        </div>
      </PageContent>
    );
  }

  if (!stats) {
    return (
      <PageContent>
        <div className="max-w-[520px] mx-auto text-center pt-12">
          <p className="text-[14px] text-[var(--tx2)]">Could not load stats. Try again later.</p>
        </div>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <div className="max-w-[520px] mx-auto">
        <section
          className={`relative overflow-hidden rounded-2xl ${PANEL_SOFT} p-6 sm:p-7 mb-10`}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(255,251,247,0.95) 45%, rgba(245,240,234,0.88) 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-14 -right-8 h-44 w-44 rounded-full blur-3xl"
            style={{ background: "rgba(92, 26, 51, 0.07)" }}
            aria-hidden
          />
          <div className="relative min-w-0">
            <p className={CREW_EYEBROW}>Crew</p>
            <h1 className="font-hero text-[26px] font-bold leading-[1.15] text-[var(--tx)] sm:text-[28px] tracking-tight">
              Stats &amp; leaderboard
            </h1>
            <p className="mt-3 text-[13px] text-[var(--tx2)]">
              <span className="font-semibold text-[var(--tx)]">{stats.teamName ?? "Team"}</span>
              <span className="text-[var(--tx3)]"> · </span>
              {monthLabel}
            </p>
          </div>
          <div
            className="relative mt-6 h-px w-full bg-gradient-to-r from-transparent via-[#5C1A33]/20 to-transparent"
            aria-hidden
          />
          {stats.yourRankThisMonth != null && (
            <div className="relative mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2C3E2D]/[0.08] px-3 py-1.5 text-[11px] font-semibold text-[var(--tx)]">
                <Ranking size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
                #{stats.yourRankThisMonth} this month
              </span>
              <span className="text-[11px] text-[var(--tx3)] leading-snug">
                Sorted by average rating (ties by activity).
              </span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-3.5 mb-12">
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                Jobs
              </span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)] tabular-nums leading-none">{stats.thisMonth.jobs}</div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">This month</div>
          </div>
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <Star size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                Rating
              </span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)] tabular-nums leading-none">
              {stats.thisMonth.avgRating != null
                ? stats.thisMonth.avgRating.toFixed(1)
                : stats.profile.avgRating.toFixed(1)}
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">Avg this month</div>
          </div>
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <CurrencyDollar size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                Tips
              </span>
            </div>
            <div className="text-[26px] font-bold tabular-nums leading-none" style={{ color: MONEY_INK }}>
              ${stats.thisMonth.tips}
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">${stats.thisMonth.avgTipPerJob} avg/job</div>
          </div>
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendUp size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                Career
              </span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)] tabular-nums leading-none">{stats.profile.totalJobs}</div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">Total jobs</div>
          </div>
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                On-time
              </span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)] tabular-nums leading-none">
              {onTimeDisplay(stats.profile.onTimeRate)}
            </div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">Arrival record</div>
          </div>
          <div className={STAT_TILE}>
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldWarning
                size={14}
                className={stats.profile.damageIncidents > 0 ? "text-amber-700" : "text-[#2C3E2D]"}
                weight="duotone"
                aria-hidden
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                Safety
              </span>
            </div>
            <div className="text-[26px] font-bold text-[var(--tx)] tabular-nums leading-none">{stats.profile.damageIncidents}</div>
            <div className="text-[10px] text-[var(--tx3)] mt-2">Damage incidents</div>
          </div>
        </div>

        <div className="mb-12">
          <p className={SECTION_EYEBROW}>Recognition</p>
          <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[var(--tx)] tracking-tight mb-6">Your badges</h2>
          {stats.badges.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {stats.badges.map((badge) => (
                <div key={badge.id} className={`flex items-start gap-3 ${STAT_TILE} p-3.5`}>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(92, 26, 51, 0.1)", color: WINE }}
                  >
                    {BADGE_ICONS[badge.icon] || <Medal size={16} weight="fill" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-[var(--tx)]">{badge.name}</p>
                    <p className="text-[10px] text-[var(--tx2)] leading-relaxed mt-0.5">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#2C3E2D]/[0.04] px-5 py-8 text-center">
              <Medal size={28} className="mx-auto mb-3 text-[#2C3E2D]/35" weight="duotone" aria-hidden />
              <p className="text-[13px] font-semibold text-[var(--tx)]">No badges yet</p>
              <p className="text-[12px] text-[var(--tx2)] mt-2 leading-relaxed max-w-[34ch] mx-auto">
                Complete jobs, earn strong ratings, and keep claims low — badges unlock as you hit milestones.
              </p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <p className={SECTION_EYEBROW}>Team</p>
          <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[var(--tx)] tracking-tight mb-6">
            Leaderboard · {monthLabel}
          </h2>
          {stats.leaderboard.length > 0 ? (
            <div className={`${PANEL_SOFT} overflow-hidden divide-y divide-[var(--brd)]/30`}>
              {stats.leaderboard.map((entry, i) => {
                const isYou = stats.crewMemberName && entry.name === stats.crewMemberName;
                return (
                  <div
                    key={entry.name || i}
                    className={`flex items-center gap-3 px-4 py-3.5 ${isYou ? "bg-[#2C3E2D]/[0.04]" : ""}`}
                  >
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 tabular-nums"
                      style={{
                        background: i === 0 ? "rgba(92, 26, 51, 0.12)" : "rgba(44, 62, 45, 0.06)",
                        color: i === 0 ? WINE : "var(--tx3)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--tx)] truncate">{entry.name}</p>
                        {isYou && (
                          <span className="shrink-0 rounded-md bg-[#2C3E2D]/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#243524]">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {entry.monthJobs} job{entry.monthJobs !== 1 ? "s" : ""} · ${entry.monthTips} tips
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Star size={12} className="text-[#2C3E2D]" weight="fill" aria-hidden />
                      <span className="text-[12px] font-bold text-[var(--tx)] tabular-nums">
                        {entry.avgRating > 0 ? entry.avgRating.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-white/70 px-5 py-10 text-center shadow-[0_2px_24px_rgba(44,62,45,0.05)]">
              <Trophy size={32} className="mx-auto mb-3 text-[#2C3E2D]/30" weight="duotone" aria-hidden />
              <p className="text-[13px] font-semibold text-[var(--tx)]">No rankings yet this month</p>
              <p className="text-[12px] text-[var(--tx2)] mt-2 leading-relaxed max-w-[34ch] mx-auto">
                As soon as crews finish jobs and ratings are in, the board fills up.
              </p>
            </div>
          )}
        </div>

        {tipData && tipData.summary.count > 0 && (
          <div className="mt-12">
            <p className={SECTION_EYEBROW}>Earnings</p>
            <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[var(--tx)] tracking-tight mb-6">My tips</h2>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-5">
              <div className={`${STAT_TILE} p-3 text-center`}>
                <div className="flex items-center justify-center mb-1">
                  <Coins size={14} className="text-[#2C3E2D]" weight="duotone" aria-hidden />
                </div>
                <div className="text-[17px] font-bold tabular-nums leading-none" style={{ color: MONEY_INK }}>
                  ${Math.round(tipData.summary.totalEarned)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)] mt-2 [font-family:var(--font-body)]">
                  Total
                </div>
              </div>
              <div className={`${STAT_TILE} p-3 text-center`}>
                <div className="text-[17px] font-bold text-[var(--tx)] tabular-nums leading-none">
                  ${Math.round(tipData.summary.avgTip)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)] mt-2 [font-family:var(--font-body)]">
                  Avg / job
                </div>
              </div>
              <div className={`${STAT_TILE} p-3 text-center`}>
                <div className="text-[17px] font-bold tabular-nums leading-none" style={{ color: WINE }}>
                  ${Math.round(tipData.summary.highestTip)}
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)] mt-2 [font-family:var(--font-body)]">
                  Best
                </div>
              </div>
            </div>

            {tipData.monthlyBreakdown.some((m) => m.amount > 0) && (
              <div className={`${PANEL_SOFT} p-4 mb-5`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] mb-4 [font-family:var(--font-body)]">
                  Monthly tips
                </p>
                <div className="flex gap-2 items-end h-12">
                  {tipData.monthlyBreakdown.map((m) => {
                    const maxAmount = Math.max(...tipData.monthlyBreakdown.map((x) => x.amount), 1);
                    const height = Math.max(4, Math.round((m.amount / maxAmount) * 40));
                    return (
                      <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm transition-opacity"
                          style={{
                            height,
                            background: m.amount > 0 ? FOREST : "var(--brd)",
                            opacity: m.amount > 0 ? 0.85 : 0.25,
                          }}
                          title={`${m.label}: $${Math.round(m.amount)}`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-1">
                  {tipData.monthlyBreakdown.map((m) => (
                    <div key={m.label} className="flex-1 text-center">
                      <span className="text-[9px] text-[var(--tx3)]">{m.label.split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`${PANEL_SOFT} overflow-hidden divide-y divide-[var(--brd)]/30`}>
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] [font-family:var(--font-body)]">
                  Recent gratuities
                </p>
              </div>
              {tipData.tips.slice(0, 10).map((tip) => (
                <div key={tip.id} className="flex items-center justify-between px-4 py-3.5 gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-[var(--tx)] truncate">{tip.client_name || "Client"}</p>
                    <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {new Date(tip.charged_at).toLocaleDateString("en-CA", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span className="text-[14px] font-bold tabular-nums shrink-0" style={{ color: MONEY_INK }}>
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
