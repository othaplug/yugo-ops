"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Clock, Calendar, Check, Lock, Package } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { getDisplayLabel } from "@/lib/displayLabels";
import Link from "next/link";
import PageContent from "@/app/admin/components/PageContent";
import ReadinessCheck from "./components/ReadinessCheck";
import { formatDate, formatDateYmd } from "@/lib/client-timezone";
import { getLocalHourInAppTimezone } from "@/lib/business-timezone";
import CrewAreaWeather from "@/components/crew/CrewAreaWeather";
import JobConditionsInline from "@/components/crew/JobConditionsInline";
import WineFadeRule from "@/components/crew/WineFadeRule";
import { useCrewJobConditions } from "@/components/crew/useCrewJobConditions";
import type { MoveWeatherBrief } from "@/lib/weather/move-weather-brief";

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
  isRecurring?: boolean;
  bookingType?: string | null;
  eventPhase?: string | null;
  eventName?: string | null;
  weatherBrief?: MoveWeatherBrief | null;
  weatherAlert?: string | null;
}

interface DashboardData {
  crewMember: { name: string; role: string; teamName?: string; dateStr?: string };
  jobs: Job[];
  /** YYYY-MM-DD used to load jobs (server business calendar). */
  scheduleDateYmd?: string;
  scheduleTimezone?: string;
  scheduleTimezoneShort?: string;
  businessLocalHour?: number;
  readinessCompleted?: boolean;
  readinessRequired?: boolean;
  isCrewLead?: boolean;
  endOfDaySubmitted?: boolean;
  hasActiveBinTasks?: boolean;
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
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        if (isInitial) {
          setError(
            typeof d?.error === "string" && d.error.trim()
              ? d.error
              : `Could not load dashboard (${r.status}). Try again or sign in.`
          );
        }
        return;
      }
      if (d && typeof d === "object" && d.crewMember != null) {
        setError("");
        setData({
          ...d,
          jobs: Array.isArray(d.jobs) ? d.jobs : [],
        } as DashboardData);
      } else if (isInitial) {
        setError("Session expired");
      }
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

  const jobsForConditions = data != null && Array.isArray(data.jobs) ? data.jobs : [];
  const { weatherByJobId, trafficByJobId, trafficLoading } = useCrewJobConditions(jobsForConditions);

  const completedStatuses = ["delivered", "completed", "done", "cancelled"];
  const isCompleted = (j: Job) => completedStatuses.includes((j.status || "").toLowerCase());
  const isInProgress = (j: Job) => (j.status || "").toLowerCase() === "in_progress";

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--tx3)]">Loading your jobs...</p>
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
            <X size={20} color="var(--red)" />
          </div>
          <p className="text-[var(--text-base)] text-[var(--red)] mb-4">{error || "Unable to load"}</p>
          <Link href="/crew/login" className="text-[13px] text-[var(--gold)] hover:underline">
            Back to login
          </Link>
        </div>
      </PageContent>
    );
  }

  const { readinessRequired, readinessCompleted, isCrewLead, endOfDaySubmitted } = data;
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const firstIncompleteIndex = jobs.findIndex((j) => !isCompleted(j));
  const canStartJob = (index: number) => index === firstIncompleteIndex;

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
            <Clock size={20} color="var(--gold)" />
          </div>
          <h2 className="font-hero text-[26px] font-bold text-[var(--tx)] mb-2">Waiting for Crew Lead</h2>
          <p className="text-[13px] text-[var(--tx3)]">The crew lead must complete the pre-trip readiness check before jobs are available.</p>
          {jobs.length > 0 && (
            <p className="text-[13px] text-[var(--tx2)] mt-4 font-medium">
              {jobs.length === 1
                ? "1 job is scheduled for your team today — it will show here after the check."
                : `${jobs.length} jobs are scheduled for your team today — they will show here after the check.`}
            </p>
          )}
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
  const hour =
    typeof data.businessLocalHour === "number" && data.businessLocalHour >= 0 && data.businessLocalHour <= 23
      ? data.businessLocalHour
      : getLocalHourInAppTimezone(now);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const scheduleFootnote =
    data.scheduleDateYmd && data.scheduleTimezone
      ? `${formatDateYmd(
          data.scheduleDateYmd,
          { weekday: "long", month: "short", day: "numeric" },
          data.scheduleTimezone,
        )} · ${data.scheduleTimezoneShort || data.scheduleTimezone}`
      : null;

  return (
    <PageContent>
      <section className="max-w-[520px] mx-auto">
        {/* Header + progress */}
        <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[var(--brd)]/25">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gold)]/95 mb-1">
              {data.crewMember?.teamName || "Team"}
            </p>
            <h1 className="font-hero text-[26px] sm:text-[28px] font-bold text-[var(--tx)] leading-[1.15] tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[13px] text-[var(--tx2)] mt-1.5">
              {scheduleFootnote ||
                data.crewMember?.dateStr ||
                formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <p className="text-[10px] text-[var(--tx3)]/75 mt-2 leading-relaxed max-w-[340px]">
              Missing a job? Confirm your team and schedule date in dispatch.
            </p>

            {totalCount > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/45">Day progress</span>
                  <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">{completedCount}/{totalCount}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--brd)]/45 overflow-hidden">
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
                  <p className="text-[10px] text-[#22C55E] font-semibold mt-2">All jobs complete — great work.</p>
                )}
              </div>
            )}
          </div>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-bold text-white shrink-0 shadow-lg ring-2 ring-[var(--gold)]/15"
            style={{ background: "linear-gradient(145deg, #D4B56C, #8B7332)" }}
          >
            {initials}
          </div>
        </div>

        {jobs.length === 0 && (
          <div className="mb-6">
            <CrewAreaWeather />
          </div>
        )}

        <div>
          {jobs.length === 0 ? (
            <div className="pt-4 pb-10 text-center rounded-2xl bg-[var(--bg)]/15 px-4">
              <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
                <Calendar size={20} color="var(--gold)" />
              </div>
              <p className="text-[15px] font-semibold text-[var(--tx)] mb-1">No jobs on the schedule</p>
              <p className="text-[12px] text-[var(--tx3)]">Check back tomorrow or contact dispatch if this looks wrong.</p>
            </div>
          ) : (
            jobs.map((job, index) => {
              const completed = isCompleted(job);
              const inProgress = isInProgress(job);
              const canStart = canStartJob(index);
              const statusInfo = STATUS_MAP[(job.status || "").toLowerCase()];

              return (
                <div key={job.id}>
                  {index > 0 && <WineFadeRule className="my-7 sm:my-8" />}
                  <article
                    className={`py-5 sm:py-6${!completed && !inProgress && !canStart ? " opacity-[0.72]" : ""}`}
                  >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div
                        className="mb-1 flex items-center tabular-nums"
                        style={{
                          color: completed ? "#22C55E" : inProgress ? "#F59E0B" : "var(--gold)",
                        }}
                      >
                        {completed ? (
                          <Check size={26} weight="bold" aria-hidden />
                        ) : (
                          <span className="text-[26px] sm:text-[28px] font-bold leading-none tracking-tight">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <span className="text-[15px] font-semibold text-[var(--tx)] truncate block leading-snug">
                        {job.clientName}
                      </span>
                      <span className="text-[10px] text-[var(--tx3)] font-mono tracking-tight block mt-0.5">{job.jobId}</span>
                      <JobConditionsInline
                        job={job}
                        weatherByJobId={weatherByJobId}
                        trafficByJobId={trafficByJobId}
                        trafficLoading={trafficLoading}
                        className="mt-2.5"
                      />
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {statusInfo ? (
                        <span
                          className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                          style={{ background: statusInfo.bg, color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </span>
                      ) : job.status ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[var(--gdim)] text-[var(--gold)]">
                          {getDisplayLabel(job.status, "status")}
                        </span>
                      ) : null}
                      <span className="text-[11px] font-medium text-[var(--tx3)] tabular-nums">{job.scheduledTime}</span>
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="flex gap-2.5">
                      {/* Dot + connector column */}
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--gold)]/50 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                        </div>
                        <div className="w-[2px] flex-1 my-1 rounded-full bg-[var(--brd)]/60" style={{ minHeight: 14 }} />
                        <div className="w-4 h-4 rounded-full border-2 border-[#22C55E]/50 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                        </div>
                      </div>
                      {/* Address text column */}
                      <div className="flex flex-col justify-between min-w-0 flex-1 gap-2">
                        <span className="text-[12px] text-[var(--tx2)] truncate pt-0.5">{job.fromAddress}</span>
                        <span className="text-[12px] text-[var(--tx2)] truncate pb-0.5">{job.toAddress}</span>
                      </div>
                    </div>

                    {/* Type + items */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-[var(--tx3)]">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] font-medium">{job.jobTypeLabel}</span>
                      {job.eventPhase && (
                        <span
                          className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                          style={{
                            background: job.eventPhase === "delivery" ? "#7C3AED22" : job.eventPhase === "return" ? "#05966922" : "#F59E0B22",
                            color: job.eventPhase === "delivery" ? "#7C3AED" : job.eventPhase === "return" ? "#059669" : "#F59E0B",
                          }}
                        >
                          {job.eventPhase === "delivery" ? "Event Delivery" : job.eventPhase === "return" ? "Event Return" : "Event Setup"}
                        </span>
                      )}
                      {job.isRecurring && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider" style={{ background: "#0D948820", color: "#0D9488" }}>
                          Recurring
                        </span>
                      )}
                      {job.itemCount != null && job.itemCount > 0 && (
                        <span>{job.itemCount} items</span>
                      )}
                    </div>

                    {/* Action area */}
                    <div className="mt-3">
                      {completed ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className="inline-flex items-center justify-center py-2 px-5 rounded-xl font-semibold text-[12px] bg-[var(--bg)]/35 text-[var(--tx2)] hover:bg-[var(--gold)]/10 hover:text-[var(--gold)] transition-all"
                        >
                          View Summary
                        </Link>
                      ) : canStart ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[13px] text-[var(--btn-text-on-accent)] transition-all shadow-sm"
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
                            "Start job"
                          )}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2 py-2 text-[11px] text-[var(--tx3)]">
                          <Lock size={12} />
                          Complete previous job first
                        </div>
                      )}
                    </div>
                  </article>
                </div>
              );
            })
          )}
        </div>

        {/* End day button */}
        {jobs.length > 0 && completedCount === totalCount && (
          endOfDaySubmitted ? (
            <Link
              href="/crew/end-of-day"
              className="mt-6 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-[12px] transition-all bg-[var(--bg)]/35 text-[var(--tx2)] hover:bg-[#22C55E]/10 hover:text-[var(--grn)]"
            >
              <Check size={14} weight="bold" />
              End of day submitted, Update report
            </Link>
          ) : (
            <Link
              href="/crew/end-of-day"
              className="mt-6 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-[12px] text-white transition-all"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
            >
              <Check size={14} weight="bold" />
              Complete Your Day
            </Link>
          )
        )}
        {jobs.length > 0 && completedCount < totalCount && (
          <Link
            href="/crew/end-of-day"
            className="mt-6 flex items-center justify-center py-3 rounded-xl font-medium text-[12px] text-[var(--tx3)] bg-[var(--bg)]/25 hover:bg-[var(--gold)]/8 hover:text-[var(--tx2)] transition-colors"
          >
            End Day Report
          </Link>
        )}

        {data.hasActiveBinTasks && (
          <Link
            href="/crew/bin-orders"
            className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-[12px] text-[var(--tx3)] bg-[var(--bg)]/20 hover:bg-[var(--gold)]/8 hover:text-[var(--gold)] transition-colors"
          >
            <Package size={14} />
            Bin Tasks (Drop-offs &amp; Pickups)
          </Link>
        )}
      </section>
    </PageContent>
  );
}
