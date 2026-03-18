"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/AppIcons";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { getStatusLabel, normalizeStatus, MOVE_STATUS_COLORS_ADMIN, MOVE_STATUS_LINE_COLOR, DELIVERY_STATUS_LINE_COLOR } from "@/lib/move-status";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import LiveActivityFeed from "./components/LiveActivityFeed";

/* ── Types ── */

type Job = {
  id: string;
  type: "delivery" | "move";
  name: string;
  subtitle: string;
  time: string;
  status: string;
  date: string;
  tag: string;
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

interface LiveSession {
  id: string;
  jobId: string;
  jobType: string;
  jobName: string;
  status: string;
  teamName: string;
  crewLeadName: string;
  updatedAt: string;
  toAddress: string | null;
}

type MonthRevenue = { m: string; moves: number; deliveries: number; invoices: number };

interface Props {
  todayJobs: Job[];
  upcomingJobs: Job[];
  todayJobCount: number;
  overdueAmount: number;
  overdueCount: number;
  currentMonthRevenue: number;
  revenuePctChange: number;
  revenueBreakdown: { moves: number; deliveries: number; invoices: number };
  monthlyRevenue: MonthRevenue[];
  activityEvents: ActivityEvent[];
  activeQuotesCount: number;
  actionTasks: ActionTask[];
}

/* ── Helpers ── */

function getJobHref(job: Job): string {
  if (job.type === "delivery") {
    const slug = job.delivery_number || job.id;
    return `/admin/deliveries/${encodeURIComponent(slug)}`;
  }
  const slug = job.move_code?.trim().replace(/^#/, "").toUpperCase() || job.id;
  return `/admin/moves/${slug}`;
}

function getJobLineColor(job: Job): string {
  if (job.type === "delivery") return DELIVERY_STATUS_LINE_COLOR[job.status] || "var(--gold)";
  const n = normalizeStatus(job.status) || "";
  return MOVE_STATUS_LINE_COLOR[job.status] || MOVE_STATUS_LINE_COLOR[n] || "var(--gold)";
}

function getJobStatusStyle(job: Job): string {
  if (job.type === "delivery") {
    const map: Record<string, string> = {
      pending: "text-[var(--gold)] bg-[var(--gdim)]",
      scheduled: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
      confirmed: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
      dispatched: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
      "in-transit": "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
      delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
      cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
    };
    return map[job.status] || "text-[var(--tx3)] bg-[var(--gdim)]";
  }
  const n = normalizeStatus(job.status) || "";
  return MOVE_STATUS_COLORS_ADMIN[job.status] || MOVE_STATUS_COLORS_ADMIN[n] || "text-[var(--tx3)] bg-[var(--gdim)]";
}

function getJobStatusLabel(job: Job): string {
  if (job.type === "delivery") {
    return job.status.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return getStatusLabel(job.status);
}

function formatActivityTime(createdAt: string): string {
  const d = new Date(createdAt);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getActivityHref(e: ActivityEvent): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery") return e.entity_id ? `/admin/deliveries/${e.entity_id}` : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  return "/admin";
}

function getActivityIcon(eventType: string, description: string | null): string {
  const et = (eventType || "").toLowerCase();
  const desc = (description || "").toLowerCase();
  if (et === "payment" || desc.includes("payment") || desc.includes("paid")) return "dollar";
  if (et === "client_message" || desc.includes("message")) return "messageSquare";
  if (et === "created" || desc.includes("new booking") || desc.includes("new referral")) return "calendar";
  if (et === "status_change" || et === "notification") return "target";
  return "bell";
}

function formatActivityDesc(desc: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) return `${match[1]} · ${getStatusLabel(match[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  return desc.length > 60 ? desc.slice(0, 57) + "..." : desc;
}

function formatRelative(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

const TAG_COLORS: Record<string, string> = {
  Retail: "text-[var(--gold)]/80",
  Move: "text-[#3B82F6]/80",
  Delivery: "text-[var(--org)]/80",
  Office: "text-[var(--pur)]/80",
  "Single Item": "text-[var(--grn)]/80",
  Gallery: "text-[#3B82F6]/80",
  Hospitality: "text-[var(--org)]/80",
  Designer: "text-[var(--pur)]/80",
};

/* ── Component ── */

export default function AdminPageClient({
  todayJobs,
  upcomingJobs,
  todayJobCount,
  overdueAmount,
  overdueCount,
  currentMonthRevenue,
  revenuePctChange,
  revenueBreakdown,
  monthlyRevenue,
  activityEvents,
  activeQuotesCount,
  actionTasks,
}: Props) {
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    const load = () => {
      fetch("/api/tracking/active")
        .then((r) => r.json())
        .then((d) => setLiveSessions(d.sessions || []))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const summaryParts: string[] = [];
  if (actionTasks.length > 0) summaryParts.push(`${actionTasks.length} task${actionTasks.length > 1 ? "s" : ""}`);
  if (todayJobCount > 0) summaryParts.push(`${todayJobCount} job${todayJobCount > 1 ? "s" : ""} today`);
  if (liveSessions.length > 0) summaryParts.push(`${liveSessions.length} crew${liveSessions.length > 1 ? "s" : ""} active`);
  if (currentMonthRevenue > 0) summaryParts.push(`${formatCompactCurrency(currentMonthRevenue)} this month`);
  if (activeQuotesCount > 0) summaryParts.push(`${activeQuotesCount} open quote${activeQuotesCount > 1 ? "s" : ""}`);

  const hasJobs = todayJobs.length > 0 || upcomingJobs.length > 0;
  const displayJobs = todayJobs.length > 0 ? todayJobs : upcomingJobs;
  const scheduleLabel = todayJobs.length > 0 ? "Today\u2019s Schedule" : "Upcoming";

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-5 sm:py-6 md:py-8 animate-fade-up min-w-0">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-heading text-[26px] sm:text-[30px] md:text-[34px] font-bold text-[var(--tx)] tracking-tight leading-tight">
            {greeting}
          </h1>
          <span className="text-[12px] text-[var(--tx3)] font-medium hidden sm:block">{dateStr}</span>
        </div>
        {summaryParts.length > 0 && (
          <p className="text-[13px] text-[var(--tx3)] mt-1.5 font-medium">
            {summaryParts.join(" \u00b7 ")}
          </p>
        )}
      </div>

      {/* ── Live Crew Banner (only when active) ── */}
      {liveSessions.length > 0 && (
        <div className="mb-6 flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gold)]" />
            </span>
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--gold)]">Live</span>
          </div>
          {liveSessions.map((s) => (
            <Link
              key={s.id}
              href={s.jobType === "move" ? `/admin/moves/${s.jobId}` : `/admin/deliveries/${s.jobId}`}
              className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5 hover:bg-[var(--gold)]/10 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
              <span className="text-[11px] font-semibold text-[var(--tx)] whitespace-nowrap">
                {s.teamName}
              </span>
              <span className="text-[10px] text-[var(--tx3)] whitespace-nowrap">
                {CREW_STATUS_TO_LABEL[s.status] || s.status} · {formatRelative(s.updatedAt)}
              </span>
            </Link>
          ))}
          <Link href="/admin/crew" className="shrink-0 text-[10px] font-bold text-[var(--gold)] hover:underline whitespace-nowrap">
            View map &rarr;
          </Link>
        </div>
      )}

      {/* ── Two Column Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">

        {/* ── LEFT: Schedule ── */}
        <div className="min-w-0">

          {/* ── Action Tasks (collapsible) ── */}
          {actionTasks.length > 0 && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setTasksOpen((v) => !v)}
                className="flex items-center justify-between w-full mb-3 group"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-3 h-3 text-[var(--tx3)] transition-transform duration-200 ${tasksOpen ? "rotate-90" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  ><path d="M9 18l6-6-6-6"/></svg>
                  <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 group-hover:text-[var(--tx2)] transition-colors">Tasks</h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#6B8CFF]/15 text-[#6B8CFF]">
                    {actionTasks.length}
                  </span>
                </div>
              </button>
              {tasksOpen && (
                <div className="rounded-xl border border-[#6B8CFF]/20 bg-[#6B8CFF]/[0.03] divide-y divide-[var(--brd)]/30 overflow-hidden">
                  {actionTasks.slice(0, showAllTasks ? undefined : 5).map((task) => {
                    const isDelivery = task.taskType === "delivery_request";
                    return (
                      <Link
                        key={`task-${task.id}`}
                        href={task.href}
                        className="group flex items-start gap-3 px-4 py-3 hover:bg-[#6B8CFF]/[0.05] transition-colors"
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 ${isDelivery ? "bg-[#6B8CFF]/15" : "bg-[var(--gold)]/15"}`}>
                          <Icon
                            name={isDelivery ? "truck" : "clipboard"}
                            className={`w-3 h-3 ${isDelivery ? "text-[#6B8CFF]" : "text-[var(--gold)]"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-[var(--tx)] leading-snug group-hover:text-[#6B8CFF] transition-colors">
                            {task.title}
                          </div>
                          {task.subtitle && (
                            <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">{task.subtitle}</div>
                          )}
                        </div>
                        <span className="text-[9px] text-[var(--tx3)] shrink-0 mt-1">{formatActivityTime(task.createdAt)}</span>
                      </Link>
                    );
                  })}
                  {actionTasks.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllTasks((v) => !v)}
                      className="w-full py-2.5 text-center text-[10px] font-semibold text-[#6B8CFF] hover:bg-[#6B8CFF]/[0.05] transition-colors"
                    >
                      {showAllTasks ? "Show less" : `View all ${actionTasks.length} tasks`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">{scheduleLabel}</h2>
            <Link
              href="/admin/calendar"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline transition-colors"
            >
              <Icon name="calendar" className="w-3 h-3" />
              Calendar
              <svg className="w-3 h-3 -mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </Link>
          </div>

          {hasJobs ? (
            <div className="divide-y divide-[var(--brd)]/30">
              {displayJobs.map((job) => {
                const lineColor = getJobLineColor(job);
                const statusStyle = getJobStatusStyle(job);
                const statusLabel = getJobStatusLabel(job);
                const tagColor = TAG_COLORS[job.tag] || "text-[var(--tx3)]";
                const showDate = todayJobs.length === 0;

                return (
                  <Link
                    key={`${job.type}-${job.id}`}
                    href={getJobHref(job)}
                    className="group flex items-start gap-3 py-3.5 px-1 hover:bg-[var(--card)]/40 transition-colors"
                  >
                    {/* Time / Date column */}
                    <div className="shrink-0 w-[52px] pt-0.5 text-right">
                      {showDate ? (
                        <span className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">{job.date ? formatMoveDate(job.date) : "TBD"}</span>
                      ) : (
                        <span className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">{job.time}</span>
                      )}
                    </div>

                    {/* Status line */}
                    <div className="w-[3px] rounded-full shrink-0 self-stretch min-h-[44px]" style={{ backgroundColor: lineColor }} />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold leading-tight ${statusStyle}`}>
                          {statusLabel}
                        </span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wide ${tagColor}`}>
                          {job.tag}
                        </span>
                      </div>
                      <div className="text-[14px] font-bold text-[var(--tx)] leading-snug group-hover:text-[var(--gold)] transition-colors">
                        {job.name}
                      </div>
                      {job.subtitle && (
                        <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">{job.subtitle}</div>
                      )}
                    </div>

                    {/* Arrow */}
                    <svg className="shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="text-[13px] text-[var(--tx3)] mb-3">No jobs scheduled</div>
              <Link href="/admin/quotes/new" className="inline-flex px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">
                Create a quote
              </Link>
            </div>
          )}

          {/* Upcoming preview (when showing today) */}
          {todayJobs.length > 0 && upcomingJobs.length > 0 && (
            <div className="mt-6 pt-5 border-t border-[var(--brd)]/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Coming up</h3>
                <Link href="/admin/deliveries" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">All &rarr;</Link>
              </div>
              <div className="divide-y divide-[var(--brd)]/30">
                {upcomingJobs.slice(0, 5).map((job) => (
                  <Link
                    key={`up-${job.type}-${job.id}`}
                    href={getJobHref(job)}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-[var(--card)]/30 transition-colors"
                  >
                    <span className="text-[11px] font-medium text-[var(--tx3)] tabular-nums w-[52px] text-right shrink-0">{job.date ? formatMoveDate(job.date) : "TBD"}</span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getJobLineColor(job) }} />
                    <span className="text-[12px] font-medium text-[var(--tx)] truncate flex-1">{job.name}</span>
                    <span className="text-[9px] font-semibold uppercase text-[var(--tx3)]">{job.tag}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Intelligence Column ── */}
        <div className="min-w-0 space-y-0">

          {/* Quick Actions — prominent, above revenue */}
          <div className="pb-6 grid grid-cols-2 gap-2">
            <h2 className="col-span-2 text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Quick Actions</h2>
            <Link
                href="/admin/quotes/new"
                className="flex items-center justify-center px-4 py-3.5 rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] text-[13px] font-semibold text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:shadow-[0_0_24px_rgba(201,169,98,0.2)] transition-all duration-200"
              >
                New quote
              </Link>
              <Link
                href="/admin/moves/new"
                className="flex items-center justify-center px-4 py-3.5 rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] text-[13px] font-semibold text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:shadow-[0_0_24px_rgba(201,169,98,0.2)] transition-all duration-200"
              >
                New move
              </Link>
              <Link
                href="/admin/deliveries"
                className="flex items-center justify-center px-4 py-3.5 rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] text-[13px] font-semibold text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:shadow-[0_0_24px_rgba(201,169,98,0.2)] transition-all duration-200"
              >
                Deliveries
              </Link>
              <Link
                href="/admin/reports"
                className="flex items-center justify-center px-4 py-3.5 rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] text-[13px] font-semibold text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] hover:shadow-[0_0_24px_rgba(201,169,98,0.2)] transition-all duration-200"
              >
                Reports
              </Link>
          </div>

          {/* Revenue (multi-source) */}
          <div className="pb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Revenue</h2>
              <Link
                href="/admin/revenue"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline transition-colors"
              >
                <Icon name="barChart" className="w-3 h-3" />
                Details
                <svg className="w-3 h-3 -mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </Link>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-[24px] font-bold font-heading text-[var(--tx)] tabular-nums">
                {currentMonthRevenue >= 1000 ? `$${(currentMonthRevenue / 1000).toFixed(1)}K` : formatCurrency(currentMonthRevenue)}
              </span>
              {(currentMonthRevenue > 0 || revenuePctChange !== 0) && (
                <span className={`text-[11px] font-semibold ${revenuePctChange >= 0 ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
                  {revenuePctChange >= 0 ? "\u2191" : "\u2193"}{Math.abs(revenuePctChange)}%
                </span>
              )}
            </div>
            {currentMonthRevenue > 0 && <div className="text-[9px] text-[var(--tx3)] mb-1">Before HST (13%)</div>}

            {/* Breakdown pills */}
            {currentMonthRevenue > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                {revenueBreakdown.moves > 0 && (
                  <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--tx3)]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
                    Moves {formatCompactCurrency(revenueBreakdown.moves)}
                  </span>
                )}
                {revenueBreakdown.deliveries > 0 && (
                  <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--tx3)]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#3B82F6" }} />
                    Deliveries {formatCompactCurrency(revenueBreakdown.deliveries)}
                  </span>
                )}
                {revenueBreakdown.invoices > 0 && (
                  <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--tx3)]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22C55E" }} />
                    Invoices {formatCompactCurrency(revenueBreakdown.invoices)}
                  </span>
                )}
              </div>
            )}

            {/* Stacked bar chart */}
            <div className="flex items-end gap-[3px] h-[56px]">
              {(monthlyRevenue.length > 0 ? monthlyRevenue : [{ m: "\u2014", moves: 0, deliveries: 0, invoices: 0 }] as MonthRevenue[]).map((d, i) => {
                const total = d.moves + d.deliveries + d.invoices;
                const maxV = Math.max(1, ...monthlyRevenue.map((x) => x.moves + x.deliveries + x.invoices));
                const pct = Math.round((total / maxV) * 100);
                const isNow = monthlyRevenue.length > 0 && i === monthlyRevenue.length - 1;
                const movePct = total > 0 ? (d.moves / total) * 100 : 0;
                const dlvPct = total > 0 ? (d.deliveries / total) * 100 : 0;
                const invPct = total > 0 ? (d.invoices / total) * 100 : 0;

                return (
                  <div key={`${d.m}-${i}`} className="flex-1 flex flex-col items-center gap-0.5 h-full group relative">
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t overflow-hidden min-h-[2px] transition-all duration-300 flex flex-col-reverse"
                        style={{ height: `${Math.max(pct, 6)}%` }}
                      >
                        {invPct > 0 && (
                          <div style={{ height: `${invPct}%`, background: isNow ? "#22C55E" : "rgba(34,197,94,0.25)" }} />
                        )}
                        {dlvPct > 0 && (
                          <div style={{ height: `${dlvPct}%`, background: isNow ? "#3B82F6" : "rgba(59,130,246,0.25)" }} />
                        )}
                        {movePct > 0 && (
                          <div style={{ height: `${movePct}%`, background: isNow ? "var(--gold)" : "rgba(255,255,255,0.08)" }} />
                        )}
                        {total === 0 && (
                          <div className="w-full h-full" style={{ background: "rgba(255,255,255,0.04)" }} />
                        )}
                      </div>
                    </div>
                    <span className={`text-[8px] font-medium ${isNow ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>{d.m}</span>

                    {/* Tooltip */}
                    {total > 0 && (
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                        <p className="text-[9px] font-bold text-[var(--tx)] mb-0.5">{d.m} ${total.toFixed(1)}K</p>
                        {d.moves > 0 && <p className="text-[8px] text-[var(--gold)]">Moves ${d.moves.toFixed(1)}K</p>}
                        {d.deliveries > 0 && <p className="text-[8px] text-[#3B82F6]">Deliveries ${d.deliveries.toFixed(1)}K</p>}
                        {d.invoices > 0 && <p className="text-[8px] text-[#22C55E]">Invoices ${d.invoices.toFixed(1)}K</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overdue (conditional) — keep as alert banner */}
          {overdueAmount > 0 && (
            <div className="pt-6 border-t border-[var(--brd)]/30">
              <Link href="/admin/invoices" className="flex items-center justify-between py-3 px-4 rounded-xl border border-[var(--red)]/15 bg-[var(--red)]/5 hover:bg-[var(--red)]/8 transition-colors">
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--red)]/80">Overdue</div>
                  <div className="text-[18px] font-bold text-[var(--red)] tabular-nums">{formatCompactCurrency(overdueAmount)}</div>
                </div>
                <div className="text-[11px] text-[var(--tx3)]">{overdueCount} invoice{overdueCount > 1 ? "s" : ""}</div>
              </Link>
            </div>
          )}

          {/* Activity — live feed */}
          <LiveActivityFeed initialEvents={activityEvents} />
        </div>
      </div>
    </div>
  );
}
