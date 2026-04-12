"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Check, Lock, Recycle, CaretRight } from "@phosphor-icons/react";
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
  in_progress: { label: "In Progress", color: "#B45309", bg: "rgba(245,158,11,0.14)" },
  completed: { label: "Completed", color: "#243524", bg: "rgba(44,62,45,0.12)" },
  delivered: { label: "Delivered", color: "#243524", bg: "rgba(44,62,45,0.12)" },
  done: { label: "Done", color: "#243524", bg: "rgba(44,62,45,0.12)" },
  cancelled: { label: "Cancelled", color: "#B91C1C", bg: "rgba(239,68,68,0.12)" },
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
            <div className="w-8 h-8 border-2 border-[#5C1A33]/25 border-t-[#5C1A33] rounded-full animate-spin" />
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
          <Link
            href="/crew/login"
            className="text-[13px] font-semibold text-[#5C1A33] hover:text-[#3d1222] hover:underline"
          >
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
        <div className="max-w-[520px] mx-auto pt-8 text-center px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-2 [font-family:var(--font-body)]">
            Crew
          </p>
          <h2 className="font-hero text-[26px] font-bold text-[#5C1A33] mb-3 tracking-tight">Waiting for crew lead</h2>
          <p className="text-[14px] text-[var(--tx2)] leading-relaxed">
            The crew lead must complete the pre-trip readiness check before jobs are available.
          </p>
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
        <header className="pb-2 mb-6 sm:mb-7">
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[#5C1A33] [font-family:var(--font-body)]">
              {data.crewMember?.teamName || "Team"}
            </p>
            <h1 className="font-hero text-[26px] sm:text-[28px] font-bold text-[#5C1A33] leading-[1.15] tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[14px] text-[var(--tx2)] mt-2.5 sm:mt-3">
              {scheduleFootnote ||
                data.crewMember?.dateStr ||
                formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}
            </p>
            {data.crewMember?.role === "lead" && (
              <p className="text-[12px] text-[var(--tx2)] mt-3 leading-relaxed max-w-[38ch]">
                Missing a job? Confirm your team and schedule date in dispatch.
              </p>
            )}

            {totalCount > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)] [font-family:var(--font-body)]">
                    Day progress
                  </span>
                  <span className="text-[12px] font-bold text-[var(--tx)] tabular-nums">{completedCount}/{totalCount}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--brd)]/35 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background:
                        progressPercent === 100
                          ? "linear-gradient(90deg, #2C3E2D, #243524)"
                          : "linear-gradient(90deg, #2C3E2D, #3d5240)",
                    }}
                  />
                </div>
                {progressPercent === 100 && (
                  <p className="text-[11px] font-semibold text-[#243524] mt-3 [font-family:var(--font-body)]">
                    All jobs complete — great work.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-8">
            <WineFadeRule className="opacity-50" />
          </div>
        </header>

        {jobs.length === 0 && (
          <div className="mb-6">
            <CrewAreaWeather />
          </div>
        )}

        <div>
          {jobs.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF7F2] shadow-[0_2px_28px_rgba(44,62,45,0.06)] border border-[var(--brd)]/25 px-6 py-10 text-center">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] leading-tight text-[var(--tx)] mb-3 [font-family:var(--font-body)]">
                No jobs on the schedule
              </p>
              <p className="text-[13px] text-[var(--tx2)] leading-relaxed max-w-[32ch] mx-auto">
                Check back tomorrow or contact dispatch if this looks wrong.
              </p>
            </div>
          ) : (
            jobs.map((job, index) => {
              const completed = isCompleted(job);
              const statusKey = (job.status || "").toLowerCase();
              const forestCompleteBadge = ["completed", "delivered", "done"].includes(statusKey);
              const inProgress = isInProgress(job);
              const canStart = canStartJob(index);
              const statusInfo = STATUS_MAP[statusKey];

              return (
                <div key={job.id}>
                  {index > 0 && <WineFadeRule className="my-7 sm:my-8" />}
                  <article
                    className={`py-5 sm:py-6${!completed && !inProgress && !canStart ? " opacity-[0.72]" : ""}`}
                  >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      <div
                        className="shrink-0 w-7 sm:w-8 flex justify-center pt-0.5 tabular-nums"
                        style={{
                          color: completed ? "#243524" : inProgress ? "#B45309" : "#5C1A33",
                        }}
                      >
                        {completed ? (
                          <Check size={22} weight="bold" className="shrink-0" aria-hidden />
                        ) : (
                          <span className="text-[26px] sm:text-[28px] font-bold leading-none tracking-tight">
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[15px] font-semibold text-[var(--tx)] truncate block leading-snug">
                          {job.clientName}
                        </span>
                        <span className="text-[10px] text-[var(--tx3)] font-mono tracking-tight block mt-0.5">
                          {job.jobId}
                        </span>
                        <JobConditionsInline
                          job={job}
                          weatherByJobId={weatherByJobId}
                          trafficByJobId={trafficByJobId}
                          trafficLoading={trafficLoading}
                          className="mt-2.5"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {statusInfo ? (
                        <span
                          className={
                            forestCompleteBadge
                              ? "px-2.5 py-1 rounded-none bg-[#2C3E2D]/[0.08] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] [font-family:var(--font-body)] leading-none"
                              : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                          }
                          style={
                            forestCompleteBadge
                              ? undefined
                              : { background: statusInfo.bg, color: statusInfo.color }
                          }
                        >
                          {statusInfo.label}
                        </span>
                      ) : job.status ? (
                        <span
                          className={
                            forestCompleteBadge
                              ? "px-2.5 py-1 rounded-none bg-[#2C3E2D]/[0.08] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] [font-family:var(--font-body)] leading-none"
                              : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#2C3E2D]/10 text-[#243524]"
                          }
                        >
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
                        <div className="w-4 h-4 rounded-full border-2 border-[#5C1A33]/40 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#5C1A33]" />
                        </div>
                        <div className="w-[2px] flex-1 my-1 rounded-full bg-[var(--brd)]/50" style={{ minHeight: 14 }} />
                        <div className="w-4 h-4 rounded-full border-2 border-[#2C3E2D]/40 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#2C3E2D]" />
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
                            background: job.eventPhase === "delivery" ? "#7C3AED22" : job.eventPhase === "return" ? "#2C3E2D22" : "#B4530922",
                            color: job.eventPhase === "delivery" ? "#7C3AED" : job.eventPhase === "return" ? "#243524" : "#B45309",
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
                          className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] border-2 border-[#2C3E2D] text-[#243524] bg-transparent hover:bg-[#2C3E2D]/[0.05] transition-colors [font-family:var(--font-body)]"
                        >
                          View summary
                          <CaretRight size={14} weight="bold" className="shrink-0" aria-hidden />
                        </Link>
                      ) : canStart ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className={`flex items-center justify-center gap-2 min-h-[52px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--btn-text-on-accent)] transition-all shadow-[0_4px_20px_rgba(44,62,45,0.15)] [font-family:var(--font-body)] ${
                            inProgress ? "" : "crew-premium-cta"
                          }`}
                          style={
                            inProgress
                              ? {
                                  background:
                                    "linear-gradient(165deg, #5C1A33 0%, #3e1021 42%, #2a0c18 100%)",
                                }
                              : undefined
                          }
                        >
                          {inProgress ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                              </span>
                              Return to job
                            </>
                          ) : (
                            <>
                              Start job
                              <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
                            </>
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
              className="mt-8 flex items-center justify-center gap-1.5 min-h-[48px] py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] border-2 border-[#2C3E2D] text-[#243524] bg-transparent hover:bg-[#2C3E2D]/[0.05] transition-colors [font-family:var(--font-body)]"
            >
              <Check size={14} weight="bold" aria-hidden />
              Update end of day
              <CaretRight size={14} weight="bold" className="shrink-0" aria-hidden />
            </Link>
          ) : (
            <Link
              href="/crew/end-of-day"
              className="crew-premium-cta mt-8 flex items-center justify-center gap-1.5 min-h-[52px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors shadow-[0_4px_20px_rgba(44,62,45,0.18)] [font-family:var(--font-body)]"
            >
              <Check size={16} weight="bold" aria-hidden />
              Complete your day
              <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
            </Link>
          )
        )}
        {jobs.length > 0 && completedCount < totalCount && (
          <Link
            href="/crew/end-of-day"
            className="mt-8 flex items-center justify-center gap-1 min-h-[48px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tx2)] hover:text-[#243524] transition-colors [font-family:var(--font-body)]"
          >
            End day report
            <CaretRight size={14} weight="bold" className="shrink-0 opacity-80" aria-hidden />
          </Link>
        )}

        {data.hasActiveBinTasks && (
          <Link
            href="/crew/bin-orders"
            className="mt-4 flex items-center justify-center gap-2 min-h-[48px] py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx2)] border border-[var(--brd)]/80 hover:border-[#2C3E2D]/35 hover:bg-[#2C3E2D]/[0.04] hover:text-[#243524] transition-colors [font-family:var(--font-body)]"
          >
            <Recycle size={16} aria-hidden />
            Bin tasks
            <CaretRight size={14} weight="bold" className="shrink-0" aria-hidden />
          </Link>
        )}
      </section>
    </PageContent>
  );
}
