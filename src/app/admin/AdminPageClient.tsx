"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import Link from "next/link";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { getStatusLabel, normalizeStatus, MOVE_STATUS_COLORS_ADMIN, MOVE_STATUS_LINE_COLOR, DELIVERY_STATUS_LINE_COLOR } from "@/lib/move-status";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";
import LiveActivityFeed from "./components/LiveActivityFeed";
import { createButtonBaseClass } from "./components/CreateButton";

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
  retail: "text-[var(--gold)]/80",
  Retail: "text-[var(--gold)]/80",
  move: "text-[#3B82F6]/80",
  Move: "text-[#3B82F6]/80",
  delivery: "text-[var(--org)]/80",
  Delivery: "text-[var(--org)]/80",
  office: "text-[var(--pur)]/80",
  Office: "text-[var(--pur)]/80",
  single_item: "text-[var(--grn)]/80",
  "Single Item": "text-[var(--grn)]/80",
  gallery: "text-[#3B82F6]/80",
  Gallery: "text-[#3B82F6]/80",
  hospitality: "text-[var(--org)]/80",
  Hospitality: "text-[var(--org)]/80",
  designer: "text-[var(--pur)]/80",
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
  const router = useRouter();
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => { router.refresh(); }, [router]);
  const { containerRef: pullRef, pullDistance, refreshing } = usePullToRefresh({ onRefresh: refresh });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) setQuickActionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    <div
      ref={pullRef as React.RefObject<HTMLDivElement>}
      className="h-screen overflow-y-auto overscroll-contain"
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed left-1/2 z-[100] flex items-center justify-center w-9 h-9 rounded-full shadow-lg"
          style={{
            top: 56,
            transform: `translate(-50%, ${pullDistance}px)`,
            backgroundColor: "var(--card)",
            border: "1px solid var(--brd)",
          }}
          aria-live="polite"
        >
          {refreshing ? (
            <span className="spinner w-4 h-4" />
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="2.5"
              style={{ transform: `rotate(${(pullDistance / 72) * 180}deg)`, transition: "transform 0.1s" }}
            >
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          )}
        </div>
      )}

    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-5 sm:py-6 md:py-8 animate-fade-up min-w-0">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">
              {greeting}
            </h1>
            <p className="text-[12px] text-[var(--tx3)] font-medium mt-1">{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick Actions button */}
            <div className="relative" ref={quickActionsRef}>
              <button
                type="button"
                title="Quick Actions"
                aria-label="Quick Actions"
                onClick={() => setQuickActionsOpen((v) => !v)}
                className={`${createButtonBaseClass} gap-1.5`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              {quickActionsOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl py-1.5 overflow-hidden">
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 px-4 pt-2 pb-1.5">Create</p>
                  {[
                    { href: "/admin/quotes/new", label: "New Quote" },
                    { href: "/admin/moves/new", label: "New Move" },
                    { href: "/admin/deliveries/new", label: "New Delivery" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setQuickActionsOpen(false)}
                      className="flex items-center px-4 py-2.5 text-[13px] font-semibold text-[var(--tx)] hover:bg-[var(--bg)] hover:text-[var(--gold)] transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                  <div className="border-t border-[var(--brd)]/50 my-1" />
                  <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 px-4 pt-1.5 pb-1.5">Navigate</p>
                  {[
                    { href: "/admin/deliveries", label: "Deliveries" },
                    { href: "/admin/reports", label: "Reports" },
                    { href: "/admin/calendar", label: "Calendar" },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setQuickActionsOpen(false)}
                      className="flex items-center px-4 py-2.5 text-[13px] font-semibold text-[var(--tx)] hover:bg-[var(--bg)] hover:text-[var(--gold)] transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Summary pills */}
        {summaryParts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {summaryParts.map((part) => (
              <span
                key={part}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold bg-[var(--card)] border border-[var(--brd)]/60 text-[var(--tx3)]"
              >
                {part}
              </span>
            ))}
          </div>
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
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">
                    {actionTasks.length}
                  </span>
                </div>
              </button>
              {tasksOpen && (
                <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.03] divide-y divide-[var(--brd)]/30 overflow-hidden">
                  {actionTasks.slice(0, showAllTasks ? undefined : 5).map((task) => (
                      <Link
                        key={`task-${task.id}`}
                        href={task.href}
                        className="group flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--gold)]/[0.05] active:bg-[var(--gold)]/10 transition-colors touch-manipulation"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-[var(--tx)] leading-snug group-hover:text-[var(--gold)] transition-colors">
                            {task.title}
                          </div>
                          {task.subtitle && (
                            <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">{task.subtitle}</div>
                          )}
                        </div>
                        <span className="text-[9px] text-[var(--tx3)] shrink-0 mt-1">{formatActivityTime(task.createdAt)}</span>
                      </Link>
                  ))}
                  {actionTasks.length > 5 && (
                    <button
                      type="button"
                      onClick={() => setShowAllTasks((v) => !v)}
                      className="w-full py-2.5 text-center text-[10px] font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/[0.05] transition-colors"
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
                    className="group flex items-start gap-3 py-4 px-1 hover:bg-[var(--card)]/40 active:bg-[var(--card)]/60 transition-colors touch-manipulation"
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

                    {/* Arrow — always visible on mobile, hover-only on desktop */}
                    <svg className="shrink-0 w-4 h-4 text-[var(--tx3)]/40 md:opacity-0 md:group-hover:opacity-100 transition-opacity mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div className="text-[14px] font-semibold text-[var(--tx)] mb-1">No jobs scheduled</div>
              <p className="text-[12px] text-[var(--tx3)] mb-4">Get started by creating a quote or checking the calendar.</p>
              <div className="flex items-center justify-center gap-2">
                <Link href="/admin/quotes/new" className="inline-flex px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">
                  Create a quote
                </Link>
                <Link href="/admin/calendar" className="inline-flex px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--gold)]/40 transition-colors">
                  View calendar
                </Link>
              </div>
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
                {upcomingJobs.slice(0, 5).map((job) => {
                  const upTagColor = TAG_COLORS[job.tag] || TAG_COLORS[job.tag?.toLowerCase()] || "text-[var(--tx3)]";
                  return (
                  <Link
                    key={`up-${job.type}-${job.id}`}
                    href={getJobHref(job)}
                    className="flex items-center gap-3 py-2.5 px-1 hover:bg-[var(--card)]/30 transition-colors"
                  >
                    <span className="text-[11px] font-medium text-[var(--tx3)] tabular-nums w-[52px] text-right shrink-0">{job.date ? formatMoveDate(job.date) : "TBD"}</span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getJobLineColor(job) }} />
                    <span className="text-[12px] font-medium text-[var(--tx)] truncate flex-1">{job.name}</span>
                    <span className={`text-[9px] font-semibold uppercase ${upTagColor}`}>{job.tag}</span>
                  </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Intelligence Column ── */}
        <div className="min-w-0 space-y-0">

          {/* Revenue (multi-source) */}
          <div className="pb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Revenue</h2>
              <Link
                href="/admin/revenue"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline transition-colors"
              >
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
              <Link href="/admin/invoices" className="group flex items-center justify-between py-3 px-4 rounded-xl border border-[var(--red)]/15 bg-[var(--red)]/5 hover:bg-[var(--red)]/10 hover:border-[var(--red)]/30 transition-all cursor-pointer">
                <div>
                  <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--red)]/80">Overdue</div>
                  <div className="text-[18px] font-bold text-[var(--red)] tabular-nums group-hover:opacity-80 transition-opacity">{formatCompactCurrency(overdueAmount)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--tx3)]">{overdueCount} invoice{overdueCount > 1 ? "s" : ""}</span>
                  <svg className="w-3.5 h-3.5 text-[var(--red)]/30 group-hover:text-[var(--red)]/70 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                </div>
              </Link>
            </div>
          )}

          {/* Activity — live feed */}
          <LiveActivityFeed initialEvents={activityEvents} />
        </div>
      </div>
    </div>
    </div>
  );
}
