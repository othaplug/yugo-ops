"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageContent from "@/app/admin/components/PageContent";
import ReadinessCheck from "./components/ReadinessCheck";
import { formatDate } from "@/lib/client-timezone";

interface Job {
  id: string;
  jobId: string;
  jobType: "move" | "delivery";
  clientName: string;
  fromAddress: string;
  toAddress: string;
  jobTypeLabel: string;
  itemCount?: number;
  scheduledTime: string;
  status: string;
  completedAt?: string | null;
}

interface DashboardData {
  crewMember: { name: string; role: string; teamName?: string; dateStr?: string };
  jobs: Job[];
  readinessCompleted?: boolean;
  readinessRequired?: boolean;
  isCrewLead?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: "In Progress", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  completed: { label: "Completed", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  delivered: { label: "Delivered", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  done: { label: "Done", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  cancelled: { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

export default function CrewDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      const r = await fetch("/api/crew/dashboard");
      if (r.status === 401) { router.replace("/crew/login"); return; }
      const d = await r.json();
      if (d) setData(d);
      else if (isInitial) setError("Session expired");
    } catch {
      if (isInitial) setError("Failed to load jobs");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData(true);
    intervalRef.current = setInterval(() => fetchData(false), 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  const completedStatuses = ["delivered", "completed", "done", "cancelled"];
  const isCompleted = (j: Job) => completedStatuses.includes((j.status || "").toLowerCase());
  const isInProgress = (j: Job) => (j.status || "").toLowerCase() === "in_progress";

  const firstIncompleteIndex = data?.jobs.findIndex((j) => !isCompleted(j)) ?? -1;
  const canStartJob = (index: number) => index === firstIncompleteIndex;

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-body text-[var(--tx3)]">Loading your jobs...</p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (error || !data) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--red)]/10 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <p className="text-title text-[var(--red)] mb-4">{error || "Unable to load"}</p>
          <Link href="/crew/login" className="text-body text-[var(--gold)] hover:underline">
            Back to login
          </Link>
        </div>
      </PageContent>
    );
  }

  const { jobs, readinessRequired, readinessCompleted, isCrewLead } = data;

  if (readinessRequired && !readinessCompleted) {
    if (isCrewLead) {
      return (
        <PageContent>
          <ReadinessCheck onComplete={() => window.location.reload()} />
        </PageContent>
      );
    }
    return (
      <PageContent>
        <div className="max-w-[420px] mx-auto pt-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h2 className="font-hero text-h1 font-bold text-[var(--tx)] mb-2">Waiting for Crew Lead</h2>
          <p className="text-body text-[var(--tx3)]">The crew lead must complete the pre-trip readiness check before jobs are available.</p>
        </div>
      </PageContent>
    );
  }

  const firstName = data.crewMember?.name?.split(/\s+/)[0] || "Crew";
  const initials = (data.crewMember?.name || "C")
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const completedCount = jobs.filter(isCompleted).length;
  const totalCount = jobs.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <PageContent>
      <section className="max-w-[520px] mx-auto">
        {/* Hero greeting */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="text-caption font-semibold uppercase tracking-[1.5px] text-[var(--gold)] mb-1">
              {data.crewMember?.teamName || "Team"}
            </p>
            <h1 className="font-hero text-hero font-bold text-[var(--tx)] leading-tight">{greeting}, {firstName}</h1>
            <p className="text-body text-[var(--tx3)] mt-1">
              {data.crewMember?.dateStr || formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}
            </p>
          </div>
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-body font-bold text-white shrink-0 shadow-md"
            style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
          >
            {initials}
          </div>
        </div>

        {/* Day progress */}
        {totalCount > 0 && (
          <div className="pt-6 mt-6 border-t border-[var(--brd)]/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Day Progress</span>
              <span className="text-ui font-bold text-[var(--tx)]">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--brd)]/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: progressPercent === 100
                    ? "linear-gradient(90deg, #22C55E, #16A34A)"
                    : "linear-gradient(90deg, #C9A962, #D4B56C)",
                }}
              />
            </div>
            {progressPercent === 100 && (
              <p className="text-caption text-[#22C55E] font-semibold mt-2">All jobs complete — great work today!</p>
            )}
          </div>
        )}

        {/* Jobs list */}
        <h2 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 pt-6 mt-6 border-t border-[var(--brd)]/30 mb-4">
          Today&apos;s Jobs
        </h2>

        <div className="space-y-0">
          {jobs.length === 0 ? (
            <div className="pt-8 pb-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p className="text-title font-semibold text-[var(--tx)] mb-1">No jobs today</p>
              <p className="text-ui text-[var(--tx3)]">Enjoy your day off — check back tomorrow.</p>
            </div>
          ) : (
            jobs.map((job, index) => {
              const completed = isCompleted(job);
              const inProgress = isInProgress(job);
              const canStart = canStartJob(index);
              const statusInfo = STATUS_MAP[(job.status || "").toLowerCase()];

              return (
                <div
                  key={job.id}
                  className={`pt-6 pb-6 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0 transition-all ${
                    completed
                      ? ""
                      : inProgress
                        ? ""
                        : canStart
                          ? ""
                          : "opacity-75"
                  }`}
                >
                  <div>
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-caption font-bold shrink-0"
                          style={{
                            background: completed ? "rgba(34,197,94,0.15)" : inProgress ? "rgba(245,158,11,0.15)" : "var(--gdim)",
                            color: completed ? "#22C55E" : inProgress ? "#F59E0B" : "var(--gold)",
                          }}
                        >
                          {completed ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            index + 1
                          )}
                        </span>
                        <div className="min-w-0">
                          <span className="text-title font-semibold text-[var(--tx)] truncate block leading-tight">
                            {job.clientName}
                          </span>
                          <span className="text-label text-[var(--tx3)] font-mono">{job.jobId}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusInfo && (
                          <span
                            className="px-2 py-0.5 rounded-md text-section font-bold uppercase tracking-wider"
                            style={{ background: statusInfo.bg, color: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </span>
                        )}
                        <span className="text-caption font-medium text-[var(--tx3)]">
                          {job.scheduledTime}
                        </span>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="ml-[38px] space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--gold)]/40 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                        </div>
                        <span className="text-ui text-[var(--tx2)] truncate">{job.fromAddress}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-[#22C55E]/40 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                        </div>
                        <span className="text-ui text-[var(--tx2)] truncate">{job.toAddress}</span>
                      </div>
                    </div>

                    {/* Type + items */}
                    <div className="ml-[38px] mt-2 flex items-center gap-3 text-label text-[var(--tx3)]">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] font-medium">{job.jobTypeLabel}</span>
                      {job.itemCount != null && job.itemCount > 0 && (
                        <span>{job.itemCount} items</span>
                      )}
                    </div>

                    {/* Action area */}
                    <div className="mt-3 ml-[38px]">
                      {completed ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className="inline-flex items-center justify-center py-2 px-5 rounded-xl font-semibold text-ui border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
                        >
                          View Summary
                        </Link>
                      ) : canStart ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-body text-[var(--btn-text-on-accent)] transition-all shadow-sm"
                          style={{
                            background: inProgress
                              ? "linear-gradient(135deg, #F59E0B, #D97706)"
                              : "linear-gradient(135deg, #C9A962, #8B7332)",
                          }}
                        >
                          {inProgress ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                              </span>
                              Return to Job
                            </>
                          ) : (
                            "Start Job"
                          )}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-caption text-[var(--tx3)]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Complete previous job first
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* End day button */}
        {jobs.length > 0 && completedCount === totalCount && (
          <Link
            href="/crew/end-of-day"
            className="mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-title text-white transition-all shadow-lg"
            style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            Complete Your Day
          </Link>
        )}
        {jobs.length > 0 && completedCount < totalCount && (
          <Link
            href="/crew/end-of-day"
            className="mt-6 flex items-center justify-center py-3 rounded-xl font-medium text-ui text-[var(--tx3)] border border-[var(--brd)] hover:border-[var(--gold)]/50 transition-colors"
          >
            End Day Report
          </Link>
        )}
      </section>
    </PageContent>
  );
}
