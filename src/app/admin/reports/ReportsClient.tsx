"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import KpiCard from "@/components/ui/KpiCard";
import { InfoHint } from "@/components/ui/InfoHint";
import CrewReportsTab from "./CrewReportsTab";

/* ── Shared types ── */

interface EodReport {
  id: string;
  team_id: string;
  report_date: string;
  summary?: Record<string, unknown>;
  jobs?: {
    jobId: string;
    type: string;
    sessionId?: string | null;
    duration: number;
    status?: string;
    signOff?: boolean;
    rating?: number | null;
    displayId: string;
    clientName: string;
    hasDamage?: boolean;
  }[];
  crew_note?: string | null;
  readiness?: { passed?: boolean; flaggedItems?: string[] } | null;
  expenses?: { category: string; amount: number; description?: string }[];
  generated_at?: string;
  crews?: { name: string } | null;
}

interface CrewFinancialSnapshot {
  crewHourlyCost: number;
  totalLabourPay: number;
  jobCount: number;
  avgLabourPerJob: number;
  totalTips: number;
  tipCount: number;
  avgTip: number;
  expenseReimbursements: number;
  expenseCount: number;
  monthlyLabour: {
    month: string;
    moves: number;
    deliveries: number;
    total: number;
    count: number;
  }[];
  teamLabourLeaders: { crewId: string; name: string; labour: number; jobs: number }[];
}

interface OpsMove {
  id: string;
  status: string;
  crew_id: string | null;
  scheduled_date: string;
  completed_at: string | null;
}

interface TrackingSession {
  id: string;
  job_id: string;
  job_type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  team_id: string | null;
}

const TABS = [
  { key: "crew", label: "Crew Reports" },
  { key: "financial", label: "Crew pay" },
  { key: "operations", label: "Operations" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m || "1", 10) - 1]} ${y}`;
}

export default function ReportsClient({
  eodReports,
  eodKpis,
  initialDate,
  initialFrom,
  initialTo,
  initialTab,
  crewFinancial,
  opsMovesThisMonth,
  trackingSessions,
  crewNames = {},
}: {
  eodReports: EodReport[];
  eodKpis: { reportCount: number; totalJobs: number; teamCount: number };
  initialDate: string;
  initialFrom?: string;
  initialTo?: string;
  initialTab?: string;
  crewFinancial: CrewFinancialSnapshot;
  opsMovesThisMonth: OpsMove[];
  trackingSessions: TrackingSession[];
  crewNames?: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>(
    (TABS.find((t) => t.key === initialTab)?.key as TabKey) || "crew",
  );

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/admin/reports?${params.toString()}`, { scroll: false });
  };

  /* ══════════ Operations computations ══════════ */

  const completedMovesThisMonth = opsMovesThisMonth.filter(
    (m) => m.status === "completed" || m.status === "done",
  ).length;
  const totalMovesThisMonth = opsMovesThisMonth.length;

  const completedSessions = trackingSessions.filter((s) => s.status === "completed");
  const avgDurationMinutes = useMemo(() => {
    const durations = completedSessions
      .filter((s) => s.started_at && s.completed_at)
      .map((s) => {
        const start = new Date(s.started_at!).getTime();
        const end = new Date(s.completed_at!).getTime();
        return (end - start) / 60000;
      })
      .filter((d) => d > 0 && d < 1440);

    if (durations.length === 0) return 0;
    return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  }, [completedSessions]);

  const crewUtilization = useMemo(() => {
    const crewJobs = new Map<string, number>();
    opsMovesThisMonth.forEach((m) => {
      if (m.crew_id) {
        crewJobs.set(m.crew_id, (crewJobs.get(m.crew_id) || 0) + 1);
      }
    });
    const counts = Array.from(crewJobs.values());
    if (counts.length === 0) return { avgPerCrew: 0, crewCount: 0 };
    const avg = Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10;
    return { avgPerCrew: avg, crewCount: counts.length };
  }, [opsMovesThisMonth]);

  const onTimeRate = useMemo(() => {
    const movesWithCompletion = opsMovesThisMonth.filter(
      (m) => m.completed_at && m.scheduled_date,
    );
    if (movesWithCompletion.length === 0) return null;

    const onTime = movesWithCompletion.filter((m) => {
      const scheduled = new Date(m.scheduled_date + "T23:59:59").getTime();
      const completed = new Date(m.completed_at!).getTime();
      return completed <= scheduled;
    }).length;

    return Math.round((onTime / movesWithCompletion.length) * 100);
  }, [opsMovesThisMonth]);

  const sessionsByTeam = useMemo(() => {
    const map = new Map<string, number>();
    trackingSessions.forEach((s) => {
      if (s.team_id && s.status === "completed") {
        map.set(s.team_id, (map.get(s.team_id) || 0) + 1);
      }
    });
    return map;
  }, [trackingSessions]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    opsMovesThisMonth.forEach((m) => {
      map.set(m.status, (map.get(m.status) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [opsMovesThisMonth]);

  const STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    quoted: "Quoted",
    sent: "Sent",
    viewed: "Viewed",
    accepted: "Accepted",
    expired: "Expired",
    pending: "Pending",
    pending_approval: "Pending Approval",
    confirmed: "Confirmed",
    scheduled: "Scheduled",
    assigned: "Assigned",
    en_route: "En Route",
    en_route_to_pickup: "En Route to Pickup",
    arrived: "Arrived",
    in_progress: "In Progress",
    completed: "Completed",
    done: "Completed",
    invoiced: "Invoiced",
    paid: "Paid",
    unpaid: "Unpaid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    hold: "On Hold",
    on_hold: "On Hold",
    disputed: "Disputed",
    refunded: "Refunded",
  };

  return (
    <div className="space-y-0">
      {/* ── Tab bar (eyebrow / label styling) ── */}
      <div className="flex flex-wrap items-center gap-1 mb-6" role="tablist" aria-label="Report sections">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(tab.key)}
              className={`px-4 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors ${
                isActive
                  ? "bg-[var(--card)] text-[var(--tx)]"
                  : "text-[var(--tx3)]/85 hover:text-[var(--tx)] hover:bg-[var(--card)]/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Crew Reports tab ── */}
      {activeTab === "crew" && (
        <div className="animate-fade-up">
          <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-6">
            <KpiCard label="Reports" value={String(eodKpis.reportCount)} sub="for selected period" />
            <KpiCard label="Jobs Covered" value={String(eodKpis.totalJobs)} sub="across all reports" />
            <KpiCard label="Active Teams" value={String(eodKpis.teamCount)} sub="in period" accent={eodKpis.teamCount > 0} />
          </div>
          <CrewReportsTab
            initialReports={eodReports}
            initialDate={initialDate}
            initialFrom={initialFrom}
            initialTo={initialTo}
          />
        </div>
      )}

      {/* ── Crew pay tab (labour cost, tips, reimbursements) ── */}
      {activeTab === "financial" && (
        <div className="animate-fade-up space-y-8">
          <div className="relative pb-8 border-b border-[var(--brd)]">
            <div className="absolute right-0 top-0 z-10">
              <InfoHint variant="admin" ariaLabel="How crew pay figures are calculated">
                <span>
                  Labour pay is modeled as crew headcount × hours × platform crew hourly cost (or stored move labour cost
                  when present). Tips are net amounts to crew. Reimbursements are approved crew expense claims.
                </span>
              </InfoHint>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pr-8 sm:pr-10">
              <KpiCard
                label="Est. labour pay"
                value={formatCurrency(crewFinancial.totalLabourPay)}
                sub={`${crewFinancial.jobCount} jobs · last 6 mo`}
              />
              <KpiCard
                label="Avg labour / job"
                value={formatCurrency(crewFinancial.avgLabourPerJob)}
                sub={`${formatCurrency(crewFinancial.crewHourlyCost)}/hr cost model`}
              />
              <KpiCard
                label="Tips (net)"
                value={formatCurrency(crewFinancial.totalTips)}
                sub={`${crewFinancial.tipCount} tip${crewFinancial.tipCount !== 1 ? "s" : ""} · moves`}
                accent={crewFinancial.totalTips > 0}
              />
              <KpiCard
                label="Expense reimbursements"
                value={formatCurrency(crewFinancial.expenseReimbursements)}
                sub={`${crewFinancial.expenseCount} approved`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
            <section>
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-4">
                Labour pay by team
              </h2>
              {crewFinancial.teamLabourLeaders.length === 0 ? (
                <p className="text-[13px] text-[var(--tx3)]">No crew-assigned jobs in the last 6 months.</p>
              ) : (
                <ul className="divide-y divide-[var(--brd)]/50 border-y border-[var(--brd)]/60">
                  {crewFinancial.teamLabourLeaders.map((row) => {
                    const maxL = crewFinancial.teamLabourLeaders[0]?.labour || 1;
                    const pct = maxL > 0 ? (row.labour / maxL) * 100 : 0;
                    return (
                      <li key={row.crewId} className="py-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[12px] font-medium text-[var(--tx)] truncate">{row.name}</span>
                          <span className="text-[12px] font-heading font-semibold text-[var(--tx)] tabular-nums shrink-0">
                            {formatCurrency(row.labour)}
                            <span className="text-[var(--tx3)] font-normal"> · {row.jobs} job{row.jobs !== 1 ? "s" : ""}</span>
                          </span>
                        </div>
                        <div className="h-1 bg-[var(--brd)]/35 overflow-hidden">
                          <div
                            className="h-full bg-[var(--admin-primary-fill)] transition-all duration-500"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <div className="mb-4 flex items-start gap-2">
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 flex-1">
                  Avg tip (when tipped)
                </h2>
                <InfoHint variant="admin" ariaLabel="Tip data scope" className="shrink-0">
                  Moves only. Delivery tips are not tracked in this table yet.
                </InfoHint>
              </div>
              <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/78 mb-1">Per tip</p>
              <p className="text-[22px] font-bold font-heading text-[var(--tx)] leading-none">
                {crewFinancial.tipCount > 0 ? formatCurrency(crewFinancial.avgTip) : "$0"}
              </p>
            </section>
          </div>

          <section>
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-4">
              Monthly labour pay (last 6 months)
            </h2>
            {crewFinancial.monthlyLabour.length === 0 ? (
              <p className="text-[13px] text-[var(--tx3)]">No scheduled jobs in range.</p>
            ) : (
              <table className="w-full text-[13px] border-collapse border-t border-b border-[var(--brd)]/60">
                <thead>
                  <tr className="border-b border-[var(--brd)]/50">
                    <th className="text-left py-3 pr-4 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Month</th>
                    <th className="text-right py-3 px-2 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Moves</th>
                    <th className="text-right py-3 px-2 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Deliveries</th>
                    <th className="text-right py-3 px-2 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Total</th>
                    <th className="text-right py-3 pl-2 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {crewFinancial.monthlyLabour.map((row) => (
                    <tr key={row.month} className="border-t border-[var(--brd)]/35">
                      <td className="py-3 pr-4 font-medium text-[var(--tx)]">{monthLabel(row.month + "-01")}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-[var(--tx2)]">{formatCurrency(row.moves)}</td>
                      <td className="py-3 px-2 text-right tabular-nums text-[var(--tx2)]">{formatCurrency(row.deliveries)}</td>
                      <td className="py-3 px-2 text-right tabular-nums font-heading font-semibold text-[var(--tx)]">
                        {formatCurrency(row.total)}
                      </td>
                      <td className="py-3 pl-2 text-right tabular-nums text-[var(--tx3)]">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      {/* ── Operations tab ── */}
      {activeTab === "operations" && (
        <div className="animate-fade-up space-y-8">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
            <KpiCard
              label="Moves This Month"
              value={String(totalMovesThisMonth)}
              sub={`${completedMovesThisMonth} completed`}
            />
            <KpiCard
              label="Avg Duration"
              value={avgDurationMinutes > 0 ? `${Math.floor(avgDurationMinutes / 60)}h ${avgDurationMinutes % 60}m` : "-"}
              sub="per completed session"
            />
            <KpiCard
              label="Crew Utilization"
              value={crewUtilization.avgPerCrew > 0 ? String(crewUtilization.avgPerCrew) : "-"}
              sub={crewUtilization.crewCount > 0 ? `jobs/crew · ${crewUtilization.crewCount} crews` : "no data"}
            />
            <KpiCard
              label="On-Time Rate"
              value={onTimeRate !== null ? `${onTimeRate}%` : "-"}
              sub="completed on scheduled day"
              accent={onTimeRate !== null && onTimeRate >= 90}
              warn={onTimeRate !== null && onTimeRate < 70}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14">
            <section>
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-4">
                Move Status Breakdown
              </h2>
              {statusBreakdown.length === 0 ? (
                <p className="text-[13px] text-[var(--tx3)]">No moves this month.</p>
              ) : (
                <ul className="divide-y divide-[var(--brd)]/50 border-y border-[var(--brd)]/60">
                  {statusBreakdown.map((item) => {
                    const pct = totalMovesThisMonth > 0 ? (item.count / totalMovesThisMonth) * 100 : 0;
                    return (
                      <li key={item.status} className="py-3">
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <span className="text-[12px] font-medium text-[var(--tx)]">
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                          <span className="text-[12px] text-[var(--tx3)] tabular-nums shrink-0">
                            {item.count} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="h-1 bg-[var(--brd)]/35 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              item.status === "completed" || item.status === "done" || item.status === "paid"
                                ? "bg-[var(--grn)]"
                                : item.status === "cancelled" || item.status === "disputed"
                                  ? "bg-[var(--red)]"
                                  : item.status === "in_progress" || item.status === "en_route" || item.status === "en_route_to_pickup"
                                    ? "bg-[var(--admin-primary-fill)]"
                                    : item.status === "invoiced" || item.status === "overdue" || item.status === "unpaid"
                                      ? "bg-amber-500"
                                      : "bg-[var(--tx3)]/40"
                            }`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-4">
                Completed Sessions by Team
              </h2>
              {sessionsByTeam.size === 0 ? (
                <p className="text-[13px] text-[var(--tx3)]">No completed sessions this month.</p>
              ) : (
                <ul className="divide-y divide-[var(--brd)]/50 border-y border-[var(--brd)]/60">
                  {Array.from(sessionsByTeam.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([teamId, count]) => {
                      const maxTeam = Math.max(...Array.from(sessionsByTeam.values()));
                      const pct = maxTeam > 0 ? (count / maxTeam) * 100 : 0;
                      const teamName = crewNames[teamId] || `Crew ${teamId.slice(0, 6)}`;
                      return (
                        <li key={teamId} className="py-3">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-[12px] font-medium text-[var(--tx)] truncate min-w-0">{teamName}</span>
                            <span className="text-[12px] font-heading font-semibold text-[var(--tx)] tabular-nums shrink-0">
                              {count} session{count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="h-1 bg-[var(--brd)]/35 overflow-hidden">
                            <div
                              className="h-full bg-[var(--admin-primary-fill)] transition-all duration-500"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </section>
          </div>

          <section>
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/82 mb-4">
              Session Performance
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8">
              <KpiCard label="Total Sessions" value={String(trackingSessions.length)} />
              <KpiCard label="Completed" value={String(completedSessions.length)} accent={completedSessions.length > 0} />
              <KpiCard
                label="Active"
                value={String(trackingSessions.filter((s) => s.status === "active" || s.status === "in_progress").length)}
              />
              <KpiCard
                label="Completion Rate"
                value={
                  trackingSessions.length > 0
                    ? `${Math.round((completedSessions.length / trackingSessions.length) * 100)}%`
                    : "-"
                }
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
