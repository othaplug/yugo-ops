"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import KpiCard from "@/components/ui/KpiCard";
import CrewReportsTab from "./CrewReportsTab";
import {
  ChartBar,
  ClipboardText,
  GearSix,
  Clock,
  Users,
  CheckCircle,
  TrendUp,
  CurrencyDollar,
} from "@phosphor-icons/react";

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

interface MoveFinancial {
  id: string;
  service_type: string;
  estimate: number;
  status: string;
  scheduled_date: string;
}

interface DeliveryFinancial {
  id: string;
  total_price: number;
  status: string;
  scheduled_date: string;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
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

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential",
  long_distance: "Long Distance",
  office_move: "Office",
  single_item: "Single Item",
  white_glove: "White Glove",
  specialty: "Specialty",
  event: "Event",
  b2b_delivery: "B2B Delivery",
  labour_only: "Labour Only",
};

const TABS = [
  { key: "crew", label: "Crew Reports", icon: ClipboardText },
  { key: "financial", label: "Financial", icon: ChartBar },
  { key: "operations", label: "Operations", icon: GearSix },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function monthLabel(dateStr: string): string {
  const [y, m] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m || "1", 10) - 1]} ${y}`;
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export default function ReportsClient({
  eodReports,
  eodKpis,
  initialDate,
  initialFrom,
  initialTo,
  initialTab,
  financialMoves,
  financialDeliveries,
  invoices,
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
  financialMoves: MoveFinancial[];
  financialDeliveries: DeliveryFinancial[];
  invoices: Invoice[];
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

  /* ══════════ Financial computations ══════════ */

  const revenueByServiceType = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    financialMoves.forEach((m) => {
      const key = m.service_type;
      const cur = map.get(key) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += m.estimate;
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .map(([type, val]) => ({ type, label: SERVICE_LABELS[type] || type, ...val }))
      .sort((a, b) => b.total - a.total);
  }, [financialMoves]);

  const monthlyRevenue = useMemo(() => {
    const map = new Map<string, { moves: number; deliveries: number; total: number; count: number }>();

    financialMoves.forEach((m) => {
      const mk = monthKey(m.scheduled_date);
      const cur = map.get(mk) || { moves: 0, deliveries: 0, total: 0, count: 0 };
      cur.moves += m.estimate;
      cur.total += m.estimate;
      cur.count += 1;
      map.set(mk, cur);
    });

    financialDeliveries.forEach((d) => {
      const mk = monthKey(d.scheduled_date);
      const cur = map.get(mk) || { moves: 0, deliveries: 0, total: 0, count: 0 };
      cur.deliveries += d.total_price;
      cur.total += d.total_price;
      cur.count += 1;
      map.set(mk, cur);
    });

    return Array.from(map.entries())
      .map(([month, val]) => ({ month, ...val }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 6);
  }, [financialMoves, financialDeliveries]);

  const totalMoveRevenue = financialMoves.reduce((s, m) => s + m.estimate, 0);
  const totalDeliveryRevenue = financialDeliveries.reduce((s, d) => s + d.total_price, 0);
  const totalRevenue = totalMoveRevenue + totalDeliveryRevenue;
  const totalJobsFinancial = financialMoves.length + financialDeliveries.length;
  const avgJobValue = totalJobsFinancial > 0 ? Math.round(totalRevenue / totalJobsFinancial) : 0;

  const invoicePaid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const invoiceTotal = invoices.reduce((s, i) => s + i.amount, 0);

  const maxServiceRevenue = revenueByServiceType.length > 0 ? revenueByServiceType[0].total : 1;

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
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 border-b border-[var(--brd)] mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors relative ${
                isActive
                  ? "text-[var(--gold)]"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              <Icon size={16} weight={isActive ? "fill" : "regular"} />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--gold)] rounded-t-full" />
              )}
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

      {/* ── Financial tab ── */}
      {activeTab === "financial" && (
        <div className="animate-fade-up space-y-8">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
            <KpiCard
              label="Total Revenue"
              value={formatCurrency(totalRevenue)}
              sub="last 6 months"
            />
            <KpiCard
              label="Avg Job Value"
              value={formatCurrency(avgJobValue)}
              sub={`${totalJobsFinancial} jobs`}
            />
            <KpiCard
              label="Invoiced"
              value={formatCurrency(invoiceTotal)}
              sub={`${invoices.length} invoices`}
            />
            <KpiCard
              label="Collected"
              value={formatCurrency(invoicePaid)}
              sub={invoiceTotal > 0 ? `${Math.round((invoicePaid / invoiceTotal) * 100)}% collected` : "-"}
              accent={invoicePaid > 0}
            />
          </div>

          {/* Revenue by service type */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollar size={16} className="text-[var(--gold)]" weight="bold" />
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">
                Revenue by Service Type
              </h2>
            </div>
            {revenueByServiceType.length === 0 ? (
              <p className="text-[13px] text-[var(--tx3)]">No move data in the last 6 months.</p>
            ) : (
              <div className="space-y-3">
                {revenueByServiceType.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-[var(--tx)]">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[var(--tx3)] tabular-nums">{item.count} jobs</span>
                        <span className="text-[13px] font-heading font-semibold text-[var(--tx)] tabular-nums">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--brd)]/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
                        style={{ width: `${Math.max(2, (item.total / maxServiceRevenue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly revenue table */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendUp size={16} className="text-[var(--gold)]" weight="bold" />
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">
                Monthly Revenue (Last 6 Months)
              </h2>
            </div>
            {monthlyRevenue.length === 0 ? (
              <p className="text-[13px] text-[var(--tx3)]">No revenue data available.</p>
            ) : (
              <div className="rounded-xl border border-[var(--brd)] overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      <th className="text-left px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">Month</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">Moves</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">Deliveries</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">Total</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">Jobs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRevenue.map((row, i) => (
                      <tr
                        key={row.month}
                        className={`border-t border-[var(--brd)]/40 ${i === 0 ? "bg-[var(--gold)]/[0.03]" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-[var(--tx)]">{monthLabel(row.month + "-01")}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--tx2)]">
                          {formatCurrencyFull(row.moves)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--tx2)]">
                          {formatCurrencyFull(row.deliveries)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-heading font-semibold text-[var(--tx)]">
                          {formatCurrencyFull(row.total)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--tx3)]">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Move status breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle size={16} className="text-[var(--gold)]" weight="bold" />
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">
                  Move Status Breakdown
                </h2>
              </div>
              {statusBreakdown.length === 0 ? (
                <p className="text-[13px] text-[var(--tx3)]">No moves this month.</p>
              ) : (
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3">
                  {statusBreakdown.map((item) => {
                    const pct = totalMovesThisMonth > 0 ? (item.count / totalMovesThisMonth) * 100 : 0;
                    return (
                      <div key={item.status}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-medium text-[var(--tx)]">
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                          <span className="text-[12px] text-[var(--tx3)] tabular-nums">
                            {item.count} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--brd)]/40 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.status === "completed" || item.status === "done" || item.status === "paid"
                                ? "bg-[var(--grn)]"
                                : item.status === "cancelled" || item.status === "disputed"
                                  ? "bg-[var(--red)]"
                                  : item.status === "in_progress" || item.status === "en_route" || item.status === "en_route_to_pickup"
                                    ? "bg-[var(--gold)]"
                                    : item.status === "invoiced" || item.status === "overdue" || item.status === "unpaid"
                                      ? "bg-amber-500"
                                      : "bg-[var(--tx3)]/40"
                            }`}
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tracking sessions by team */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-[var(--gold)]" weight="bold" />
                <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">
                  Completed Sessions by Team
                </h2>
              </div>
              {sessionsByTeam.size === 0 ? (
                <p className="text-[13px] text-[var(--tx3)]">No completed sessions this month.</p>
              ) : (
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3">
                  {Array.from(sessionsByTeam.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([teamId, count]) => {
                      const maxTeam = Math.max(...Array.from(sessionsByTeam.values()));
                      const pct = maxTeam > 0 ? (count / maxTeam) * 100 : 0;
                      const teamName = crewNames[teamId] || `Crew ${teamId.slice(0, 6)}`;
                      return (
                        <div key={teamId}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-medium text-[var(--tx)] truncate max-w-[200px]">
                              {teamName}
                            </span>
                            <span className="text-[12px] font-heading font-semibold text-[var(--tx)] tabular-nums">
                              {count} session{count !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--brd)]/40 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
                              style={{ width: `${Math.max(2, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Session performance */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={16} className="text-[var(--gold)]" weight="bold" />
              <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60">
                Session Performance
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Total Sessions</div>
                <div className="text-[22px] font-bold font-heading text-[var(--tx)]">{trackingSessions.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Completed</div>
                <div className="text-[22px] font-bold font-heading text-[var(--grn)]">{completedSessions.length}</div>
              </div>
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Active</div>
                <div className="text-[22px] font-bold font-heading text-[var(--gold)]">
                  {trackingSessions.filter((s) => s.status === "active" || s.status === "in_progress").length}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Completion Rate</div>
                <div className="text-[22px] font-bold font-heading text-[var(--tx)]">
                  {trackingSessions.length > 0 ? `${Math.round((completedSessions.length / trackingSessions.length) * 100)}%` : "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
