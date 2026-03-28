"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ArrowsClockwise as RefreshCw,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  Phone,
  Envelope as Mail,
  ChatText as MessageSquare,
  Users,
  X,
  Calendar as CalendarDays,
  Warning as AlertTriangle,
  CheckCircle as CheckCircle2,
  Crosshair,
} from "@phosphor-icons/react";
import { addCalendarDaysYmd } from "@/lib/business-timezone";
import { formatDateYmd } from "@/lib/client-timezone";
import DispatchSchedule from "@/components/dispatch/DispatchSchedule";
import ActivityFeed from "@/components/dispatch/ActivityFeed";
import AlertBar from "@/components/dispatch/AlertBar";
import RoutingSuggestionBanner from "@/components/dispatch/RoutingSuggestionBanner";
import { useToast } from "../components/Toast";
import type { DispatchJob } from "@/components/dispatch/JobCard";
import type { DispatchEvent } from "@/components/dispatch/ActivityFeed";
import type { DispatchAlert } from "@/components/dispatch/AlertBar";

interface DispatchData {
  date: string;
  jobs: DispatchJob[];
  crews: { id: string; name: string }[];
  events: DispatchEvent[];
  stats: {
    jobsToday: number;
    assigned: number;
    unassigned: number;
    activeCrews: number;
    completed: number;
  };
  alerts: DispatchAlert[];
}

interface Props {
  today: string;
}

type FilterStatus = "all" | "unassigned" | "active" | "completed";

const ACTIVE_STATUSES_F = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "in_transit",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
];
const COMPLETED_STATUSES_F = ["completed", "delivered", "job_complete"];

function formatLastUpdated(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  return `${Math.floor(ms / 60000)}m ago`;
}

export default function DispatchBoardClient({ today }: Props) {
  const [data, setData] = useState<DispatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [contactJob, setContactJob] = useState<DispatchJob | null>(null);
  const [reassignJob, setReassignJob] = useState<DispatchJob | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [unseenEventIds, setUnseenEventIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/dispatch/today?date=${date}`);
      const contentType = res.headers.get("content-type") || "";
      let json: Record<string, unknown>;
      if (contentType.includes("application/json")) {
        json = await res.json();
      } else {
        const text = await res.text();
        const msg =
          text.includes("Internal Server Error") || text.includes("Internal S")
            ? "Server error. Please try again."
            : "Failed to load dispatch data.";
        throw new Error(msg);
      }
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load");
      const prevIds = prevEventIdsRef.current;
      const newEventIds = new Set(((json.events as DispatchEvent[]) || []).map((e) => e.id));
      const unseen = new Set<string>();
      if (prevIds.size > 0) {
        for (const id of newEventIds) {
          if (!prevIds.has(id)) unseen.add(id);
        }
      }
      prevEventIdsRef.current = newEventIds;
      setUnseenEventIds(unseen);
      setData(json as unknown as DispatchData);
      setLastFetch(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg.includes("JSON") ? "Server error. Please try again." : msg);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh || !data) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, load, data]);

  const handleReassign = useCallback(
    async (job: DispatchJob, crewId: string | null) => {
      setReassigning(true);
      try {
        const res = await fetch("/api/dispatch/assign", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id, jobType: job.type, crewId: crewId || null }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to assign");
        toast("Crew assigned", "check");
        setReassignJob(null);
        load();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to assign", "x");
      } finally {
        setReassigning(false);
      }
    },
    [load, toast]
  );

  const handleContact = useCallback((job: DispatchJob) => {
    setContactJob(job);
  }, []);

  const prevDate = addCalendarDaysYmd(date, -1);
  const nextDate = addCalendarDaysYmd(date, 1);
  const isToday = date === today;
  const shortDate = formatDateYmd(date, { weekday: "short", month: "short", day: "numeric" });

  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return [];
    switch (filterStatus) {
      case "unassigned":
        return data.jobs.filter((j) => !j.crewId);
      case "active":
        return data.jobs.filter((j) =>
          ACTIVE_STATUSES_F.includes((j.status || "").toLowerCase())
        );
      case "completed":
        return data.jobs.filter((j) =>
          COMPLETED_STATUSES_F.includes((j.status || "").toLowerCase())
        );
      default:
        return data.jobs;
    }
  }, [data?.jobs, filterStatus]);

  // Skeleton loading
  if (loading && !data) {
    return (
      <div className="animate-fade-up px-5 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 max-w-[1800px] mx-auto w-full">
        <div className="mb-9 space-y-6">
          <div className="flex items-end gap-5">
            <div className="space-y-2">
              <div className="h-2 w-14 rounded bg-[var(--gdim)] animate-pulse" />
              <div className="h-7 w-28 rounded-lg bg-[var(--gdim)] animate-pulse" />
            </div>
            <div className="flex gap-1.5 mb-0.5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-7 w-16 rounded-lg bg-[var(--gdim)] animate-pulse" />
              ))}
            </div>
          </div>
          <div className="flex gap-2.5 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[76px] w-[96px] shrink-0 rounded-2xl bg-[var(--gdim)] animate-pulse" />
            ))}
          </div>
          <div className="h-px bg-[var(--brd)]/30" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,45%)_1fr] gap-8 lg:gap-10">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-[var(--gdim)]/80 animate-pulse" />
            ))}
          </div>
          <div className="space-y-3 pl-0 lg:pl-2 lg:border-l lg:border-[var(--brd)]/20">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[var(--gdim)]/70 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 px-4">
        <div className="w-12 h-12 rounded-full bg-[var(--red)]/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-[var(--red)]" />
        </div>
        <p className="text-[var(--tx2)] text-[var(--text-base)] font-medium text-center">{error}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[12px] font-semibold hover:bg-[var(--gold2)] transition-colors touch-manipulation"
        >
          Try again
        </button>
      </div>
    );
  }

  const scheduleTitle =
    filterStatus === "unassigned" ? "Unassigned Jobs" :
    filterStatus === "active" ? "Active Jobs" :
    filterStatus === "completed" ? "Completed Jobs" :
    "Today's Schedule";

  const statCards = [
    { key: "all" as FilterStatus, label: "Jobs Today", value: data?.stats.jobsToday ?? 0, color: "text-[var(--tx)]" },
    ...(((data?.stats.unassigned ?? 0) > 0 || filterStatus === "unassigned")
      ? [{ key: "unassigned" as FilterStatus, label: "Unassigned", value: data?.stats.unassigned ?? 0, color: "text-amber-500" }]
      : []),
    { key: "active" as FilterStatus, label: "Active Crews", value: data?.stats.activeCrews ?? 0, color: "text-[#3B82F6]" },
    { key: "completed" as FilterStatus, label: "Completed", value: data?.stats.completed ?? 0, color: "text-[var(--grn)]" },
    { key: null as null, label: "Assigned", value: data?.stats.assigned ?? 0, color: "text-[var(--tx2)]" },
  ];

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem-56px)] md:min-h-[calc(100dvh-3.5rem)] h-auto md:h-[calc(100dvh-3.5rem)] animate-fade-up px-5 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 max-w-[1800px] mx-auto w-full">

      {/* ── Header ── */}
      <div className="mb-6 space-y-3">

        {/* Row 1: Title + primary CTA */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] capitalize text-[var(--tx3)]/50 leading-none mb-1.5">Operations</p>
            <h1 className="font-hero text-[26px] font-bold text-[var(--tx)] leading-none tracking-tight">Dispatch</h1>
          </div>
          <Link
            href="/admin/crew"
            className="admin-btn admin-btn-primary"
          >
            <Crosshair size={12} weight="regular" className="text-current shrink-0" aria-hidden />
            Live Map
          </Link>
        </div>

        {/* Row 2: Date navigator + secondary controls */}
        <div className="flex items-center justify-between gap-2 w-full min-w-0">

          {/* Date nav — full width on mobile (center control grows), compact from md */}
          <div className="flex flex-1 min-w-0 items-center gap-1 md:flex-initial">
            <button
              type="button"
              onClick={() => setDate(prevDate)}
              className="admin-btn-icon shrink-0"
              aria-label="Previous day"
            >
              <ChevronLeft weight="bold" className="w-3 h-3" />
            </button>

            <div className="relative min-w-0 flex-1 md:flex-initial md:w-auto">
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                className="admin-btn admin-btn-ghost w-full min-w-0 justify-center md:w-auto"
              >
                <CalendarDays weight="regular" className="w-3 h-3 shrink-0 opacity-70" />
                <span className="hidden sm:inline">{shortDate}</span>
                <span className="sm:hidden">{formatDateYmd(date, { month: "short", day: "numeric" })}</span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={date}
                onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
                className="absolute inset-0 opacity-0 w-full cursor-pointer"
                tabIndex={-1}
              />
            </div>

            {/* Today button, only shown when not on today */}
            {!isToday && (
              <button
                type="button"
                onClick={() => setDate(today)}
                className="admin-btn admin-btn-ghost shrink-0"
              >
                Today
              </button>
            )}

            <button
              type="button"
              onClick={() => setDate(nextDate)}
              className="admin-btn-icon shrink-0"
              aria-label="Next day"
            >
              <ChevronRight weight="bold" className="w-3 h-3" />
            </button>
          </div>

          {/* Secondary: auto-refresh (desktop only) + refresh */}
          <div className="flex shrink-0 items-center gap-2">
            <label className="hidden md:flex items-center gap-1.5 text-[10px] font-medium text-[var(--tx3)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <div className="hidden md:block w-px h-4 bg-[var(--brd)]" />
            <button
              onClick={() => load()}
              disabled={loading}
              className={`admin-btn admin-btn-ghost ${loading ? "opacity-50" : ""}`}
              aria-label="Refresh"
            >
              <RefreshCw weight="regular" className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
              {lastFetch > 0 && (
                <span className="hidden sm:inline text-[9px] text-[var(--tx3)]/60 font-normal tabular-nums">
                  {formatLastUpdated(Date.now() - lastFetch)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 3: KPI stat cards */}
        {data?.stats && (
          <div className="flex items-stretch gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {statCards.map((stat) =>
              stat.key !== null ? (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => setFilterStatus(filterStatus === stat.key ? "all" : stat.key!)}
                  className={`admin-kpi-card group transition-all duration-200 ${
                    filterStatus === stat.key
                      ? "border-[var(--gold)]/70 bg-[var(--gold)]/10 shadow-sm shadow-[var(--gold)]/10"
                      : "border-[var(--brd)]/50 bg-[var(--card)]/30 hover:border-[var(--gold)]/30 hover:bg-[var(--card)]/60"
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl transition-all duration-200 ${
                      filterStatus === stat.key ? "opacity-100" : "opacity-0"
                    }`}
                    style={{ background: "var(--gold)" }}
                  />
                  <p className={`admin-kpi-label transition-colors ${
                    filterStatus === stat.key ? "text-[var(--gold)]" : "text-[var(--tx3)]/60"
                  }`}>
                    {stat.label}
                  </p>
                  <p className={`admin-kpi-value transition-colors ${
                    filterStatus === stat.key ? "text-[var(--gold)]" : stat.color
                  }`}>
                    {stat.value}
                  </p>
                </button>
              ) : (
                <div
                  key="assigned-stat"
                  className="admin-kpi-card border-[var(--brd)]/50 bg-[var(--card)]/20"
                  style={{ cursor: "default" }}
                >
                  <p className="admin-kpi-label text-[var(--tx3)]/60">{stat.label}</p>
                  <p className={`admin-kpi-value ${stat.color}`}>{stat.value}</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Hairline separator */}
        <div className="h-px bg-gradient-to-r from-[var(--brd)]/60 via-[var(--brd)]/30 to-transparent" />
      </div>

      {/* Routing suggestion */}
      <RoutingSuggestionBanner date={date} />

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mb-7">
          <AlertBar alerts={data.alerts} />
        </div>
      )}

      {/* 2-column layout: Schedule + Activity Feed */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(320px,44%)_1fr] gap-8 lg:gap-10 xl:gap-12">
        {/* Left: Schedule */}
        <div className="flex flex-col min-h-[320px] lg:min-h-0 overflow-hidden">
          <div className="flex items-start justify-between mb-5 shrink-0 gap-2">
            <div>
              <h2 className="admin-section-h2 text-[var(--tx2)]">
                {scheduleTitle}
              </h2>
              {filterStatus !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilterStatus("all")}
                  className="text-[9px] text-[var(--gold)] hover:underline mt-0.5 touch-manipulation block"
                >
                  ← Show all
                </button>
              )}
            </div>
            <span className="text-[10px] text-[var(--tx3)]/60 tabular-nums shrink-0 mt-0.5">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
            </span>
          </div>
          <DispatchSchedule
            jobs={filteredJobs}
            onReassign={(j) => setReassignJob(j)}
            onContact={handleContact}
            defaultCompletedOpen={filterStatus === "completed"}
          />
        </div>

        {/* Right: Activity Feed */}
        <div className="flex flex-col min-h-[260px] lg:min-h-0 overflow-hidden border-t border-[var(--brd)]/20 lg:border-t-0 lg:border-l lg:border-[var(--brd)]/15 pt-8 lg:pt-0 lg:pl-8 xl:pl-10">
          <div className="flex items-center justify-between mb-5 shrink-0">
            <h2 className="admin-section-h2 text-[var(--tx2)]">
              Activity Feed
            </h2>
            {unseenEventIds.size > 0 && (
              <button
                type="button"
                onClick={() => setUnseenEventIds(new Set())}
                className="flex items-center gap-1 text-[9px] font-semibold text-[var(--gold)] hover:underline touch-manipulation"
              >
                <CheckCircle2 className="w-3 h-3" />
                Mark all read ({unseenEventIds.size})
              </button>
            )}
          </div>
          <ActivityFeed
            events={data?.events ?? []}
            unseenIds={unseenEventIds}
            onMarkSeen={() => setUnseenEventIds(new Set())}
          />
        </div>
      </div>

      {/* Contact bottom sheet */}
      {contactJob && (
        <div
          className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-5"
          onClick={() => setContactJob(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl w-full sm:max-w-sm animate-slide-up sm:animate-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-9 h-1 rounded-full bg-[var(--brd)] mx-auto mb-4" />
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/60 mb-0.5">
                  Contact Client
                </p>
                <h3 className="font-semibold text-[var(--tx)] text-[15px]">{contactJob.client}</h3>
                <p className="text-[10px] text-[var(--tx3)] mt-0.5">{contactJob.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setContactJob(null)}
                className="p-2 rounded-xl text-[var(--tx3)] hover:bg-[var(--bg)] transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 pb-1">
              {contactJob.clientPhone && (
                <>
                  <a
                    href={`tel:${String(contactJob.clientPhone).replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-colors touch-manipulation"
                  >
                    <div className="w-9 h-9 rounded-full bg-[var(--grn)]/15 flex items-center justify-center shrink-0">
                      <Phone weight="regular" className="w-4 h-4 text-[var(--grn)]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">Call</p>
                      <p className="text-[10px] text-[var(--tx3)]">{contactJob.clientPhone}</p>
                    </div>
                  </a>
                  <a
                    href={`sms:${String(contactJob.clientPhone).replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-colors touch-manipulation"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#3B82F6]/15 flex items-center justify-center shrink-0">
                      <MessageSquare weight="regular" className="w-4 h-4 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">SMS</p>
                      <p className="text-[10px] text-[var(--tx3)]">{contactJob.clientPhone}</p>
                    </div>
                  </a>
                </>
              )}
              {contactJob.clientEmail && (
                <a
                  href={`mailto:${contactJob.clientEmail}`}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-colors touch-manipulation"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--gold)]/15 flex items-center justify-center shrink-0">
                    <Mail weight="regular" className="w-4 h-4 text-[var(--gold)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">Email</p>
                    <p className="text-[10px] text-[var(--tx3)] truncate">{contactJob.clientEmail}</p>
                  </div>
                </a>
              )}
              {!contactJob.clientPhone && !contactJob.clientEmail && (
                <div className="px-4 py-6 text-center">
                  <p className="text-[12px] text-[var(--tx3)]">No contact info on file.</p>
                  <Link
                    href={contactJob.href}
                    className="text-[11px] text-[var(--gold)] hover:underline mt-1 block touch-manipulation"
                    onClick={() => setContactJob(null)}
                  >
                    Edit job to add contact info →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign bottom sheet */}
      {reassignJob && (
        <div
          className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-5"
          onClick={() => setReassignJob(null)}
        >
          <div
            className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl w-full sm:max-w-sm animate-slide-up sm:animate-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-9 h-1 rounded-full bg-[var(--brd)] mx-auto mb-4" />
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-[10px] font-bold tracking-[0.14em] capitalize text-[var(--tx3)]/60 mb-0.5">
                  Reassign Crew
                </p>
                <h3 className="font-semibold text-[var(--tx)] text-[15px]">{reassignJob.label}</h3>
                <p className="text-[10px] text-[var(--tx3)] mt-0.5">{reassignJob.client}</p>
              </div>
              <button
                type="button"
                onClick={() => setReassignJob(null)}
                className="p-2 rounded-xl text-[var(--tx3)] hover:bg-[var(--bg)] transition-colors touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-[50dvh] overflow-y-auto pb-1">
              <button
                type="button"
                onClick={() => handleReassign(reassignJob, null)}
                disabled={reassigning}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-colors text-left touch-manipulation disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--gdim)] flex items-center justify-center shrink-0">
                  <Users weight="regular" className="w-4 h-4 text-[var(--tx3)]" />
                </div>
                <span className="text-[13px] font-semibold text-[var(--tx2)]">Remove crew assignment</span>
              </button>
              {(data?.crews ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleReassign(reassignJob, c.id)}
                  disabled={reassigning}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border text-left transition-colors touch-manipulation disabled:opacity-60 ${
                    reassignJob.crewId === c.id
                      ? "border-[var(--gold)] bg-[var(--gold)]/10"
                      : "border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      reassignJob.crewId === c.id ? "bg-[var(--gold)]/20" : "bg-[var(--gdim)]"
                    }`}
                  >
                    <Users
                      className={`w-4 h-4 ${reassignJob.crewId === c.id ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13px] font-semibold ${reassignJob.crewId === c.id ? "text-[var(--gold)]" : ""}`}
                    >
                      {c.name}
                    </p>
                    {reassignJob.crewId === c.id && (
                      <p className="text-[9px] text-[var(--gold)]/70">Currently assigned</p>
                    )}
                  </div>
                  {reassignJob.crewId === c.id && (
                    <CheckCircle2 className="w-4 h-4 text-[var(--gold)] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
