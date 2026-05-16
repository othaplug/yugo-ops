"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import {
  getStatusLabel,
  normalizeStatus,
  MOVE_STATUS_LINE_COLOR,
  DELIVERY_STATUS_LINE_COLOR,
} from "@/lib/move-status";
import { getLocalHourInAppTimezone } from "@/lib/business-timezone";
import { formatDate } from "@/lib/client-timezone";

import { PageHeader } from "@/design-system/admin/layout";
import {
  Button,
  TierLetterBadge,
  residentialTierFullLabel,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/design-system/admin/primitives";
import { StatusPill, TrendPill } from "@/design-system/admin/primitives/Badge";
import { Avatar, AvatarStack } from "@/design-system/admin/primitives";
import {
  KpiStrip,
  SparkPanel,
  ActivityCard,
  MetricCard,
  BarChartCard,
} from "@/design-system/admin/dashboard";
import { BreakdownList } from "@/design-system/admin/dashboard/GaugeCard";
import type { RevenueBarPoint } from "@/lib/admin/command-center-data";
import { cn } from "@/design-system/admin/lib/cn";

import {
  CaretRight,
  Plus,
  ArrowsClockwise,
  Warning,
  UsersThree,
  Funnel,
} from "@/design-system/admin/icons";

/* ─────────────────────────────────────────────────────────────────────────
 * Types (mirror the existing Command Center props)
 * ──────────────────────────────────────────────────────────────────────── */

type Job = {
  id: string;
  type: "delivery" | "move";
  name: string;
  subtitle: string;
  time: string;
  status: string;
  date: string;
  tag: string;
  tier_selected?: string | null;
  delivery_number?: string | null;
  move_code?: string | null;
};

type ActionTask = {
  id: string;
  taskType: "delivery_request" | "change_request";
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
};

type ActivityEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

type MonthRevenue = { m: string; moves: number; partner: number };

type UnassignedJob = {
  id: string;
  name: string;
  date: string;
  type: "move" | "delivery";
  code: string;
  href: string;
};

type CrewCapacityDay = {
  date: string;
  label: string;
  total: number;
  booked: number;
};

type QuotePipeline = {
  openCount: number;
  openValue: number;
  viewedCount: number;
  acceptedThisWeek: number;
  conversionRate: number;
  expiringToday: number;
};

type TodayEarnings = {
  potential: number;
  collected: number;
  pending: number;
  jobCount: number;
};

type SatisfactionData = {
  avgRating: number;
  count: number;
  pendingReviews: number;
};

type LeadAttentionPreviewRow = {
  id: string;
  lead_number: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  completeness_path: string | null;
  status: string;
  service_type: string | null;
  follow_up_sent_at: string | null;
};

type LeadPulse = {
  needsAttention: number;
  avgResponseMin: number | null;
  monthReceived: number;
  attentionPreview?: LeadAttentionPreviewRow[];
};

export interface CommandCenterV3Props {
  todayJobs: Job[];
  upcomingJobs: Job[];
  todayJobCount: number;
  overdueAmount: number;
  overdueCount: number;
  currentMonthRevenue: number;
  revenuePctChange: number;
  revenueBreakdown: { moves: number; partner: number };
  monthlyRevenue: MonthRevenue[];
  revenueByDay: RevenueBarPoint[];
  activityEvents: ActivityEvent[];
  activeQuotesCount: number;
  actionTasks: ActionTask[];
  unassignedJobs: UnassignedJob[];
  crewCapacity: CrewCapacityDay[];
  quotePipeline: QuotePipeline;
  todayEarnings: TodayEarnings;
  satisfaction: SatisfactionData;
  dailyBrief: string;
  leadPulse: LeadPulse | null;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function jobHref(job: Job) {
  if (job.type === "delivery") {
    const slug = job.delivery_number || job.id;
    return `/admin/deliveries/${encodeURIComponent(slug)}`;
  }
  const slug = job.move_code?.trim().replace(/^#/, "").toUpperCase() || job.id;
  return `/admin/moves/${slug}`;
}

function jobTint(job: Job) {
  if (job.type === "delivery") {
    return DELIVERY_STATUS_LINE_COLOR[job.status] || "var(--yu3-ink-faint)";
  }
  const n = normalizeStatus(job.status) || "";
  return (
    MOVE_STATUS_LINE_COLOR[job.status] ||
    MOVE_STATUS_LINE_COLOR[n] ||
    "var(--yu3-ink-faint)"
  );
}

function jobStatusLabel(job: Job) {
  if (job.type === "delivery") {
    return job.status
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return getStatusLabel(job.status);
}

function jobStatusTone(
  job: Job,
): "wine" | "forest" | "neutral" | "warning" | "success" | "danger" | "info" {
  const n = (normalizeStatus(job.status) || job.status || "").toLowerCase();
  if (/(complete|delivered|paid|confirm|accepted|active)/.test(n))
    return "success";
  if (/(cancel|void|reject|expired|failed)/.test(n)) return "danger";
  if (
    /(progress|transit|dispatch|schedul|loading|unloading|en[_-]route)/.test(n)
  )
    return "info";
  if (/(pending|draft|review|cold|^new$|lost)/.test(n)) return "neutral";
  return "neutral";
}

function relativeTime(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function shortActivityDesc(desc: string): string {
  const m = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (m) return `${m[1]} · ${getStatusLabel(m[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  return desc.length > 80 ? desc.slice(0, 77) + "…" : desc;
}

function safeTrend(curr: number, prev: number): number {
  if (prev <= 0) return 0;
  return ((curr - prev) / prev) * 100;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────── */

export default function CommandCenterV3Client({
  todayJobs,
  upcomingJobs,
  todayJobCount,
  overdueAmount,
  overdueCount,
  currentMonthRevenue,
  revenuePctChange,
  revenueBreakdown,
  monthlyRevenue,
  revenueByDay,
  activityEvents,
  activeQuotesCount,
  actionTasks,
  unassignedJobs,
  crewCapacity,
  quotePipeline,
  todayEarnings,
  satisfaction,
  leadPulse,
}: CommandCenterV3Props) {
  const router = useRouter();

  const now = new Date();
  const hour = getLocalHourInAppTimezone(now);
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = formatDate(now, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const revenueSeries = React.useMemo(
    () => monthlyRevenue.map((m) => m.moves + m.partner),
    [monthlyRevenue],
  );

  const kpiTiles = React.useMemo(
    () => [
      {
        id: "revenue",
        label: "Revenue this month",
        value: formatCompactCurrency(currentMonthRevenue),
        trendPct: Number.isFinite(revenuePctChange) ? revenuePctChange : null,
        hint: (
          <>
            Moves {formatCompactCurrency(revenueBreakdown.moves)} · Partner{" "}
            {formatCompactCurrency(revenueBreakdown.partner)}
          </>
        ),
        spark: revenueSeries.slice(-12),
      },
      {
        id: "today-jobs",
        label: "Jobs today",
        value: todayJobCount.toString(),
        hint: `${upcomingJobs.length} upcoming`,
      },
      {
        id: "quotes",
        label: "Open quotes",
        value: quotePipeline.openCount.toString(),
        hint: (
          <>
            {formatCompactCurrency(quotePipeline.openValue)} value ·{" "}
            {quotePipeline.acceptedThisWeek} accepted
          </>
        ),
      },
      {
        id: "overdue",
        label: "Overdue receivables",
        value: formatCompactCurrency(overdueAmount),
        hint: `${overdueCount} invoices`,
      },
    ],
    [
      currentMonthRevenue,
      revenuePctChange,
      revenueBreakdown.moves,
      revenueBreakdown.partner,
      revenueSeries,
      todayJobCount,
      upcomingJobs.length,
      quotePipeline.openCount,
      quotePipeline.openValue,
      quotePipeline.acceptedThisWeek,
      overdueAmount,
      overdueCount,
    ],
  );

  const sparkItems = React.useMemo(() => {
    return [
      {
        id: "today-earnings",
        label: "Today earnings",
        value: formatCompactCurrency(todayEarnings.potential),
        hint: (
          <>
            Collected {formatCompactCurrency(todayEarnings.collected)} ·{" "}
            {todayEarnings.jobCount} jobs
          </>
        ),
      },
      {
        id: "active-quotes",
        label: "Active quotes",
        value: activeQuotesCount.toString(),
        hint: (
          <>
            {quotePipeline.viewedCount} viewed · {quotePipeline.expiringToday}{" "}
            expiring today
          </>
        ),
      },
      {
        id: "satisfaction",
        label: "Client rating",
        value: satisfaction.avgRating
          ? satisfaction.avgRating.toFixed(1)
          : "0.0",
        hint: `${satisfaction.count} reviews · ${satisfaction.pendingReviews} pending`,
      },
      {
        id: "lead-pulse",
        label: "Leads this month",
        value: leadPulse?.monthReceived?.toString() ?? "0",
        hint: leadPulse
          ? `${leadPulse.needsAttention} need attention${leadPulse.avgResponseMin != null ? ` · ${Math.round(leadPulse.avgResponseMin)}m avg` : ""}`
          : "Lead pulse unavailable",
      },
    ];
  }, [
    activeQuotesCount,
    leadPulse,
    quotePipeline.expiringToday,
    quotePipeline.viewedCount,
    satisfaction.avgRating,
    satisfaction.count,
    satisfaction.pendingReviews,
    todayEarnings.collected,
    todayEarnings.jobCount,
    todayEarnings.potential,
  ]);

  const quotePipelineBreakdown = React.useMemo(
    () => [
      {
        id: "open",
        label: "Open",
        value: quotePipeline.openCount,
        color: "var(--yu3-ink-muted)",
      },
      {
        id: "viewed",
        label: "Viewed",
        value: quotePipeline.viewedCount,
        color: "var(--yu3-info)",
      },
      {
        id: "accepted",
        label: "Accepted this week",
        value: quotePipeline.acceptedThisWeek,
        color: "var(--yu3-success)",
      },
      {
        id: "expiring",
        label: "Expiring today",
        value: quotePipeline.expiringToday,
        color: "var(--yu3-warning)",
      },
    ],
    [
      quotePipeline.acceptedThisWeek,
      quotePipeline.expiringToday,
      quotePipeline.openCount,
      quotePipeline.viewedCount,
    ],
  );

  const activityItems = React.useMemo(
    () =>
      activityEvents.map((e) => ({
        id: e.id,
        subject: shortActivityDesc(e.description || e.event_type),
        action: e.event_type.replace(/_/g, " "),
        time: relativeTime(e.created_at),
        tone: eventTone(e.event_type),
        onClick: () => router.push(entityHref(e.entity_type, e.entity_id)),
      })),
    [activityEvents, router],
  );

  const attentionCount =
    (actionTasks?.length ?? 0) +
    (leadPulse?.needsAttention ?? 0) +
    (unassignedJobs?.length ?? 0) +
    overdueCount;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <PageHeader
        eyebrow="Command Center"
        title={
          <>
            {greeting}
            <span className="text-[var(--yu3-ink-muted)] font-normal">
              {" "}
              · {dateStr}
            </span>
          </>
        }
        description="One glance across today's jobs, quote pipeline, receivables, and lead pulse."
        meta={
          <>
            <span>
              {todayJobCount} job{todayJobCount === 1 ? "" : "s"} today
            </span>
            <span className="inline-block h-3 w-px bg-[var(--yu3-line)]" />
            <span>{quotePipeline.openCount} open quotes</span>
            {attentionCount > 0 ? (
              <>
                <span className="inline-block h-3 w-px bg-[var(--yu3-line)]" />
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex cursor-pointer">
                      <StatusPill tone="warning">
                        {attentionCount} need attention
                      </StatusPill>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3" align="start">
                    <p className="text-[11px] font-semibold text-[var(--yu3-ink-muted)] uppercase tracking-wider mb-2">
                      Needs attention
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {actionTasks.length > 0 && (
                        <Link
                          href="/admin/change-requests"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                        >
                          <span className="text-[13px] text-[var(--yu3-ink-strong)]">Open tasks</span>
                          <span className="text-[11px] font-semibold text-[var(--yu3-warning)] bg-[var(--yu3-warning-tint)] rounded-full px-2 py-0.5 yu3-num">
                            {actionTasks.length}
                          </span>
                        </Link>
                      )}
                      {unassignedJobs.length > 0 && (
                        <Link
                          href="/admin/dispatch"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                        >
                          <span className="text-[13px] text-[var(--yu3-ink-strong)]">Unassigned jobs</span>
                          <span className="text-[11px] font-semibold text-[var(--yu3-wine,#8B1A4A)] bg-[var(--yu3-wine-tint,#fdf2f7)] rounded-full px-2 py-0.5 yu3-num">
                            {unassignedJobs.length}
                          </span>
                        </Link>
                      )}
                      {(leadPulse?.needsAttention ?? 0) > 0 && (
                        <Link
                          href="/admin/leads?attention=1"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                        >
                          <span className="text-[13px] text-[var(--yu3-ink-strong)]">Leads needing follow-up</span>
                          <span className="text-[11px] font-semibold text-[var(--yu3-forest,#2B5C3B)] bg-[var(--yu3-forest-tint,#f0f7f2)] rounded-full px-2 py-0.5 yu3-num">
                            {leadPulse!.needsAttention}
                          </span>
                        </Link>
                      )}
                      {overdueCount > 0 && (
                        <Link
                          href="/admin/finance/invoices?overdue=1"
                          className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                        >
                          <span className="text-[13px] text-[var(--yu3-ink-strong)]">Overdue invoices</span>
                          <span className="text-[11px] font-semibold text-[var(--yu3-danger,#C0392B)] bg-[var(--yu3-danger-tint,#fdf2f0)] rounded-full px-2 py-0.5 yu3-num">
                            {overdueCount}
                          </span>
                        </Link>
                      )}
                    </div>
                    {(leadPulse?.attentionPreview ?? []).length > 0 && (
                      <>
                        <div className="border-t border-[var(--yu3-line-subtle)] my-2" />
                        <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-1 px-2">
                          Recent leads
                        </p>
                        {(leadPulse!.attentionPreview ?? []).slice(0, 3).map((l) => (
                          <Link
                            key={l.id}
                            href={`/admin/leads/${l.id}`}
                            className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                          >
                            <span className="text-[12px] text-[var(--yu3-ink-strong)] truncate">
                              {[l.first_name, l.last_name].filter(Boolean).join(" ") || l.lead_number}
                            </span>
                            <CaretRight size={10} className="text-[var(--yu3-ink-faint)] flex-none ml-2" />
                          </Link>
                        ))}
                      </>
                    )}
                    <div className="border-t border-[var(--yu3-line-subtle)] mt-2 pt-2">
                      <button
                        onClick={() =>
                          document
                            .getElementById("attention-section")
                            ?.scrollIntoView({ behavior: "smooth" })
                        }
                        className="w-full text-[12px] text-[var(--yu3-ink-muted)] text-center py-1 hover:text-[var(--yu3-ink-strong)] transition-colors"
                      >
                        Scroll to details ↓
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<ArrowsClockwise size={14} />}
              onClick={() => router.refresh()}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus size={14} />}
              onClick={() => router.push("/admin/moves/create")}
            >
              New move
            </Button>
          </>
        }
      />

      {/* Row 1 — KPI Strip */}
      <KpiStrip tiles={kpiTiles} />

      {/* Row 2 — Split 7 / 5 */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <section className="xl:col-span-7 bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] flex flex-col">
          <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--yu3-line-subtle)]">
            <div>
              <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                Today
              </div>
              <h2 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-0.5 leading-tight">
                Jobs & dispatch
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/calendar")}
              >
                Calendar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                trailingIcon={<CaretRight size={14} />}
                onClick={() => router.push("/admin/dispatch")}
              >
                Dispatch
              </Button>
            </div>
          </header>

          <div className="flex flex-col divide-y divide-[var(--yu3-line-subtle)]">
            {todayJobs.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-[var(--yu3-ink-muted)]">
                No jobs scheduled today.
              </div>
            ) : (
              todayJobs.slice(0, 6).map((job) => (
                <Link
                  key={job.id}
                  href={jobHref(job)}
                  className="group flex items-start gap-3 px-5 py-3 hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
                >
                  <span
                    className="mt-1 h-2 w-2 rounded-full flex-none"
                    style={{ background: jobTint(job) }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <div className="text-[14px] font-medium text-[var(--yu3-ink-strong)] truncate">
                        {job.name}
                      </div>
                      <StatusPill tone={jobStatusTone(job)}>
                        {jobStatusLabel(job)}
                      </StatusPill>
                      {job.type === "move" && job.tier_selected ? (
                        <TierLetterBadge
                          tier={job.tier_selected}
                          label={residentialTierFullLabel(job.tier_selected)}
                        />
                      ) : null}
                    </div>
                    <div className="text-[12px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                      {job.subtitle}
                    </div>
                  </div>
                  <div className="flex flex-col items-end leading-tight flex-none">
                    <span className="yu3-num text-[13px] text-[var(--yu3-ink-strong)]">
                      {job.time}
                    </span>
                    <span className="text-[11px] text-[var(--yu3-ink-faint)]">
                      {serviceTypeDisplayLabel(job.tag) || job.tag}
                    </span>
                  </div>
                  <CaretRight
                    size={14}
                    className="text-[var(--yu3-ink-faint)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              ))
            )}
          </div>

          {upcomingJobs.length > 0 ? (
            <footer className="border-t border-[var(--yu3-line-subtle)] px-5 py-3 flex items-center justify-between">
              <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                Next up
              </div>
              <div className="flex items-center gap-4 text-[12px] text-[var(--yu3-ink-muted)]">
                {upcomingJobs.slice(0, 3).map((u) => (
                  <Link
                    key={u.id}
                    href={jobHref(u)}
                    className="hover:text-[var(--yu3-ink)] truncate max-w-[160px]"
                  >
                    <span className="yu3-num">{formatMoveDate(u.date)}</span>
                    <span className="mx-1">·</span>
                    {u.name}
                  </Link>
                ))}
              </div>
            </footer>
          ) : null}
        </section>

        <aside className="xl:col-span-5 flex flex-col gap-4">
          <BarChartCard
            eyebrow="Last 30 days"
            title="Revenue mix"
            series={[
              { key: "moves", label: "Moves", color: "var(--yu3-info)" },
              { key: "partner", label: "Partner", color: "var(--yu3-success)" },
            ]}
            data={revenueByDay}
            rightSlot={
              <Button
                variant="ghost"
                size="xs"
                trailingIcon={<CaretRight size={12} />}
                onClick={() => router.push("/admin/finance")}
              >
                Finance
              </Button>
            }
          >
            <div className="flex items-center justify-between pt-1 border-t border-[var(--yu3-line-subtle)]">
              <div className="text-[13px] text-[var(--yu3-ink-muted)]">
                This month total
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] yu3-num">
                  {formatCurrency(currentMonthRevenue)}
                </span>
                <span
                  className={`text-[11px] font-semibold yu3-num ${
                    revenuePctChange >= 0
                      ? "text-[var(--yu3-success)]"
                      : "text-[var(--yu3-danger)]"
                  }`}
                >
                  {revenuePctChange >= 0 ? "+" : ""}
                  {revenuePctChange.toFixed(1)}%
                </span>
              </div>
            </div>
          </BarChartCard>

          <MetricCard
            eyebrow="Quote pipeline"
            title="Conversion"
            value={`${quotePipeline.conversionRate || 0}%`}
            valueHint={
              <>
                {quotePipeline.acceptedThisWeek} accepted this week ·{" "}
                {quotePipeline.openCount} open
              </>
            }
            trendPct={safeTrend(
              quotePipeline.acceptedThisWeek,
              Math.max(1, quotePipeline.openCount / 4),
            )}
            rightSlot={
              <Button
                variant="ghost"
                size="xs"
                trailingIcon={<CaretRight size={12} />}
                onClick={() => router.push("/admin/quotes")}
              >
                Quotes
              </Button>
            }
          >
            <BreakdownList items={quotePipelineBreakdown} />
          </MetricCard>
        </aside>
      </div>

      {/* Row 3 — Sparkline quad */}
      <SparkPanel
        eyebrow="Today"
        title="Live metrics"
        items={sparkItems}
        columns={4}
      />

      {/* Row 4 — Attention (tasks / unassigned / leads) */}
      {attentionCount > 0 ? (
        <section id="attention-section" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <AttentionCard
            eyebrow="Needs action"
            title="Open tasks"
            empty="Nothing pending"
            icon={<Warning size={14} />}
            tone="warning"
            items={actionTasks.map((t) => ({
              id: t.id,
              label: t.title,
              meta: t.subtitle,
              time: relativeTime(t.createdAt),
              href: t.href,
            }))}
          />
          <AttentionCard
            eyebrow="Dispatch"
            title="Unassigned jobs"
            empty="All jobs are staffed"
            icon={<UsersThree size={14} />}
            tone="wine"
            items={unassignedJobs.map((u) => ({
              id: u.id,
              label: u.name,
              meta: u.code,
              time: formatMoveDate(u.date),
              href: u.href,
            }))}
          />
          <AttentionCard
            eyebrow="Leads"
            title="Needs attention"
            empty="All caught up"
            icon={<Funnel size={14} />}
            tone="forest"
            items={(leadPulse?.attentionPreview ?? []).map((l) => ({
              id: l.id,
              label:
                [l.first_name, l.last_name].filter(Boolean).join(" ") ||
                l.lead_number,
              meta: serviceTypeDisplayLabel(l.service_type || "") || l.status,
              time: relativeTime(l.created_at),
              href: `/admin/leads/${l.id}`,
            }))}
          />
        </section>
      ) : null}

      {/* Crew capacity */}
      {crewCapacity.length > 0 ? (
        <section className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] p-5">
          <header className="flex items-center justify-between mb-4">
            <div>
              <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                Crew capacity
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mt-0.5">
                Next 7 days
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              trailingIcon={<CaretRight size={14} />}
              onClick={() => router.push("/admin")}
            >
              Dispatch board
            </Button>
          </header>
          <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0 [-webkit-overflow-scrolling:touch]">
            {crewCapacity.map((day) => {
              const hasCapacity = day.total > 0;
              const pct = hasCapacity ? day.booked / day.total : 0;
              const tone =
                pct >= 0.9
                  ? "var(--yu3-danger)"
                  : pct >= 0.7
                    ? "var(--yu3-warning)"
                    : "var(--yu3-success)";
              return (
                <div
                  key={day.date}
                  className="flex min-w-[7.5rem] shrink-0 flex-col gap-2 p-3 sm:min-w-0 bg-[var(--yu3-bg-surface-sunken)] rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)]"
                >
                  <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
                    {day.label}
                  </div>
                  {hasCapacity ? (
                    <>
                      <div className="yu3-num text-[18px] font-semibold text-[var(--yu3-ink-strong)] leading-none">
                        {day.booked}
                        <span className="text-[12px] text-[var(--yu3-ink-muted)] font-normal">
                          {" "}
                          / {day.total}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--yu3-line-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, pct * 100)}%`,
                            background: tone,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-[var(--yu3-ink-muted)] leading-tight">
                      Not scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Activity */}
      <ActivityCard
        eyebrow="Live"
        title="Recent activity"
        items={activityItems}
        initialCount={8}
        emptyLabel="No activity yet today"
        rightSlot={
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<CaretRight size={14} />}
            onClick={() => router.push("/admin/audit-log")}
          >
            Audit log
          </Button>
        }
      />
    </div>
  );
}

/* ─── Inline subcomponents ──────────────────────────────────────────── */

function AttentionCard({
  eyebrow,
  title,
  empty,
  icon,
  tone,
  items,
}: {
  eyebrow: string;
  title: string;
  empty: string;
  icon: React.ReactNode;
  tone: "wine" | "forest" | "warning";
  items: {
    id: string;
    label: string;
    meta: string;
    time: string;
    href: string;
  }[];
}) {
  const toneBg =
    tone === "wine"
      ? "var(--yu3-wine-tint)"
      : tone === "forest"
        ? "var(--yu3-forest-tint)"
        : "var(--yu3-warning-tint)";
  const toneFg =
    tone === "wine"
      ? "var(--yu3-wine)"
      : tone === "forest"
        ? "var(--yu3-forest)"
        : "var(--yu3-warning)";
  return (
    <div className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-lg)] flex flex-col">
      <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--yu3-line-subtle)]">
        <div className="flex items-center gap-2">
          <span
            className="h-6 w-6 rounded-full inline-flex items-center justify-center"
            style={{ background: toneBg, color: toneFg }}
          >
            {icon}
          </span>
          <div>
            <div className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
              {eyebrow}
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--yu3-ink-strong)] leading-tight mt-0.5">
              {title}
            </h3>
          </div>
        </div>
        <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-[var(--yu3-ink-muted)]">
          {empty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--yu3-line-subtle)]">
          {items.slice(0, 5).map((it) => (
            <li key={it.id}>
              <Link
                href={it.href}
                className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--yu3-bg-surface-sunken)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
                    {it.label}
                  </div>
                  <div className="text-[12px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                    {it.meta}
                  </div>
                </div>
                <div className="flex flex-col items-end flex-none">
                  <span className="text-[11px] text-[var(--yu3-ink-faint)] yu3-num">
                    {it.time}
                  </span>
                  <CaretRight
                    size={12}
                    className="text-[var(--yu3-ink-faint)] mt-1"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function eventTone(
  event: string,
): "neutral" | "success" | "warning" | "danger" | "info" {
  const e = event.toLowerCase();
  if (e.includes("payment") || e.includes("paid")) return "success";
  if (e.includes("cancel") || e.includes("reject") || e.includes("failed"))
    return "danger";
  if (
    e.includes("skip") ||
    e.includes("warn") ||
    e.includes("claim") ||
    e.includes("overdue")
  )
    return "warning";
  if (
    e.includes("created") ||
    e.includes("updated") ||
    e.includes("status") ||
    e.includes("tracking") ||
    e.includes("arrived") ||
    e.includes("en_route") ||
    e.includes("en route") ||
    e.includes("change") ||
    e.includes("notification") ||
    e.includes("signoff")
  )
    return "info";
  return "neutral";
}

function entityHref(entity: string, id: string) {
  if (entity === "move") return `/admin/moves/${id}`;
  if (entity === "delivery")
    return id ? `/admin/deliveries/${id}` : "/admin/deliveries";
  if (entity === "invoice") return "/admin/invoices";
  if (entity === "quote") return `/admin/quotes/${id}`;
  if (entity === "lead") return `/admin/leads/${id}`;
  return "/admin";
}
