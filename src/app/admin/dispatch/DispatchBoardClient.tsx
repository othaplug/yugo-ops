"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MessageSquare,
  Users,
  X,
} from "lucide-react";
import { getLocalDateString, getLocalDateDisplay } from "@/lib/business-timezone";
import DispatchSchedule from "@/components/dispatch/DispatchSchedule";
import ActivityFeed from "@/components/dispatch/ActivityFeed";
import AlertBar from "@/components/dispatch/AlertBar";
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

function formatLastUpdated(ms: number): string {
  if (ms < 1000) return "just now";
  if (ms < 60000) return `${Math.floor(ms / 1000)} sec ago`;
  return `${Math.floor(ms / 60000)} min ago`;
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
  const prevEventIdsRef = useRef<Set<string>>(new Set());
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
          body: JSON.stringify({
            jobId: job.id,
            jobType: job.type,
            crewId: crewId || null,
          }),
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

  const tz = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Toronto";
  const displayDate = new Date(date + "T12:00:00");
  const prevDate = getLocalDateString(new Date(displayDate.getTime() - 86400000), tz);
  const nextDate = getLocalDateString(new Date(displayDate.getTime() + 86400000), tz);
  const isToday = date === today;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-[var(--tx3)]">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-[var(--tx2)]">{error}</p>
        <button
          type="button"
          onClick={() => { setLoading(true); load(); }}
          className="px-4 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[12px] font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-3.5rem)] h-[calc(100dvh-3.5rem)] animate-fade-up px-4 sm:px-5 md:px-6 lg:px-8 py-4 md:py-5 max-w-[1800px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-[var(--brd)] mb-4">
        <div className="flex items-center gap-4">
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">Dispatch</h1>
          <span className="text-[13px] text-[var(--tx2)]">{getLocalDateDisplay(displayDate, tz)}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(prevDate)}
              className="p-1.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDate(today)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                isToday
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDate(nextDate)}
              className="p-1.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          {/* Stat badges */}
          {data?.stats && (
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[var(--gdim)] text-[var(--tx2)] font-semibold">
                {data.stats.jobsToday} Jobs Today
              </span>
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                  data.stats.unassigned > 0 ? "bg-amber-500/20 text-amber-600" : "bg-[var(--grn)]/15 text-[var(--grn)]"
                }`}
              >
                {data.stats.assigned} Assigned
              </span>
              {data.stats.unassigned > 0 && (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-600 font-semibold">
                  {data.stats.unassigned} Unassigned
                </span>
              )}
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#3B82F6]/15 text-[#3B82F6] font-semibold">
                {data.stats.activeCrews} Active Crews
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-[var(--grn)]/15 text-[var(--grn)] font-semibold">
                {data.stats.completed} Completed
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--gold)] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <span className="text-[9px] text-[var(--tx3)]">
              {formatLastUpdated(Date.now() - lastFetch)}
            </span>
            <Link
              href="/admin/crew"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] text-[11px] font-semibold hover:bg-[var(--gold2)] transition-all"
            >
              Live Map
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mb-4">
          <AlertBar alerts={data.alerts} />
        </div>
      )}

      {/* 2-column layout: Schedule + Activity Feed */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(320px,45%)_1fr] gap-5 md:gap-6">
        {/* Left: Schedule */}
        <div className="flex flex-col min-h-[320px] lg:min-h-0 border border-[var(--brd)] rounded-xl bg-[var(--card)] p-5 overflow-hidden">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">
            Today&apos;s Schedule
          </h2>
          <DispatchSchedule
            jobs={data?.jobs ?? []}
            onReassign={(j) => setReassignJob(j)}
            onContact={handleContact}
          />
        </div>

        {/* Right: Activity Feed */}
        <div className="flex flex-col min-h-[240px] lg:min-h-0 border border-[var(--brd)] rounded-xl bg-[var(--card)] p-5 overflow-hidden">
          <h2 className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">
            Activity Feed
          </h2>
          <ActivityFeed
            events={data?.events ?? []}
            unseenIds={unseenEventIds}
            onMarkSeen={() => setUnseenEventIds(new Set())}
          />
        </div>
      </div>

      {/* Contact popover */}
      {contactJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setContactJob(null)}>
          <div
            className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--tx)]">Contact {contactJob.client}</h3>
              <button
                type="button"
                onClick={() => setContactJob(null)}
                className="p-1 rounded-lg text-[var(--tx3)] hover:bg-[var(--bg)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              {contactJob.clientPhone && (
                <>
                  <a
                    href={`tel:${String(contactJob.clientPhone).replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    Call
                  </a>
                  <a
                    href={`sms:${String(contactJob.clientPhone).replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    SMS
                  </a>
                </>
              )}
              {contactJob.clientEmail && (
                <a
                  href={`mailto:${contactJob.clientEmail}`}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </a>
              )}
              {!contactJob.clientPhone && !contactJob.clientEmail && (
                <p className="text-[12px] text-[var(--tx3)]">No contact info on file. Edit job to add.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reassign dropdown */}
      {reassignJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReassignJob(null)}>
          <div
            className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--tx)]">Reassign {reassignJob.label}</h3>
              <button
                type="button"
                onClick={() => setReassignJob(null)}
                className="p-1 rounded-lg text-[var(--tx3)] hover:bg-[var(--bg)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              <button
                type="button"
                onClick={() => handleReassign(reassignJob, null)}
                disabled={reassigning}
                className="flex items-center gap-2 w-full px-4 py-3 rounded-lg border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors text-left"
              >
                <Users className="w-4 h-4" />
                Unassign
              </button>
              {(data?.crews ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleReassign(reassignJob, c.id)}
                  disabled={reassigning}
                  className={`flex items-center gap-2 w-full px-4 py-3 rounded-lg border text-left transition-colors ${
                    reassignJob.crewId === c.id
                      ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                      : "border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
