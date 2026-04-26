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
import { isCrewSampleDashboardJobId } from "@/lib/crew/sample-dashboard-job";
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
  fromAccessLine?: string | null;
  toAccessLine?: string | null;
  postJobEquipmentComplete?: boolean;
  tipReportPending?: boolean;
}

interface DashboardData {
  crewMember: {
    name: string;
    role: string;
    teamName?: string;
    dateStr?: string;
  };
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
  eodPrerequisites?: {
    canSubmit: boolean;
    missingEquipment: { jobId: string; jobType: string; displayId: string }[];
    missingTipReport: { jobId: string; jobType: string; displayId: string }[];
  };
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> =
  {
    in_progress: {
      label: "In Progress",
      color: "#B45309",
      bg: "rgba(245,158,11,0.14)",
    },
    completed: {
      label: "Completed",
      color: "#243524",
      bg: "rgba(44,62,45,0.12)",
    },
    delivered: {
      label: "Delivered",
      color: "#243524",
      bg: "rgba(44,62,45,0.12)",
    },
    done: { label: "Done", color: "#243524", bg: "rgba(44,62,45,0.12)" },
    cancelled: {
      label: "Cancelled",
      color: "#B91C1C",
      bg: "rgba(239,68,68,0.12)",
    },
  };

export default function CrewDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(
    async (isInitial = false) => {
      try {
        const r = await fetch("/api/crew/dashboard");
        if (r.status === 401) {
          router.replace("/crew/login");
          return;
        }
        const d = await r.json().catch(() => null);
        if (!r.ok) {
          if (isInitial) {
            setError(
              typeof d?.error === "string" && d.error.trim()
                ? d.error
                : `Could not load dashboard (${r.status}). Try again or sign in.`,
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
    },
    [router],
  );

  useEffect(() => {
    fetchData(true);
    intervalRef.current = setInterval(() => fetchData(false), 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const jobsForConditions =
    data != null && Array.isArray(data.jobs)
      ? data.jobs.filter((j) => !isCrewSampleDashboardJobId(j.id))
      : [];
  const { weatherByJobId, trafficByJobId, trafficLoading } =
    useCrewJobConditions(jobsForConditions);

  const completedStatuses = ["delivered", "completed", "done", "cancelled"];
  const isSampleJob = (j: Job) => isCrewSampleDashboardJobId(j.id);
  const isCompleted = (j: Job) =>
    completedStatuses.includes((j.status || "").toLowerCase());
  const isInProgress = (j: Job) =>
    (j.status || "").toLowerCase() === "in_progress";

  const pageContentClass = "w-full min-w-0 max-w-full";

  if (loading) {
    return (
      <PageContent className={pageContentClass}>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--yu3-wine)]/25 border-t-[var(--yu3-wine)] rounded-full animate-spin" />
            <p className="text-[14px] text-[var(--yu3-ink-faint)]">
              Loading your jobs...
            </p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (error || !data) {
    return (
      <PageContent className={pageContentClass}>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--red)]/10 flex items-center justify-center mb-4">
            <X size={20} color="var(--red)" />
          </div>
          <p className="text-[var(--text-base)] text-[var(--red)] mb-4">
            {error || "Unable to load"}
          </p>
          <Link
            href="/crew/login"
            className="text-[14px] font-semibold text-[var(--yu3-wine)] hover:underline [font-family:var(--font-body)]"
          >
            Back to login
          </Link>
        </div>
      </PageContent>
    );
  }

  const {
    readinessRequired,
    readinessCompleted,
    isCrewLead,
    endOfDaySubmitted,
    eodPrerequisites,
  } = data;
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const realJobs = jobs.filter((j) => !isSampleJob(j));
  const realJobCount = realJobs.length;
  const firstIncompleteRealIndex = realJobs.findIndex((j) => !isCompleted(j));
  const firstIncompleteRealId =
    firstIncompleteRealIndex >= 0 && firstIncompleteRealIndex < realJobs.length
      ? realJobs[firstIncompleteRealIndex].id
      : null;
  const canStartJob = (index: number) => {
    const j = jobs[index];
    if (!j || isSampleJob(j) || !firstIncompleteRealId) return false;
    for (let i = 0; i < index; i += 1) {
      const prior = jobs[i];
      if (isSampleJob(prior)) continue;
      if (isCompleted(prior) && prior.postJobEquipmentComplete === false) {
        return false;
      }
    }
    return j.id === firstIncompleteRealId;
  };

  const startJobBlockReason = (index: number): "order" | "equipment" | null => {
    const j = jobs[index];
    if (!j || isSampleJob(j)) return null;
    if (isCompleted(j) || isInProgress(j)) return null;
    for (let i = 0; i < index; i += 1) {
      const prior = jobs[i];
      if (isSampleJob(prior)) continue;
      if (isCompleted(prior) && prior.postJobEquipmentComplete === false) {
        return "equipment";
      }
    }
    if (firstIncompleteRealId && j.id !== firstIncompleteRealId) {
      return "order";
    }
    return null;
  };

  if (readinessRequired && !readinessCompleted) {
    if (isCrewLead) {
      return (
        <PageContent className={pageContentClass}>
          <ReadinessCheck onComplete={() => window.location.reload()} />
        </PageContent>
      );
    }
    return (
      <PageContent className={pageContentClass}>
        <div className="max-w-[520px] mx-auto pt-8 text-center">
          <p className="yu3-t-eyebrow text-[10px] text-[var(--yu3-ink-faint)] mb-2 [font-family:var(--font-body)]">
            Crew
          </p>
          <h2 className="font-hero text-[26px] font-bold text-[var(--yu3-wine)] mb-3 tracking-tight">
            Waiting for crew lead
          </h2>
          <p className="text-[14px] text-[var(--yu3-ink-muted)] leading-relaxed">
            The crew lead must complete the pre-trip readiness check before jobs
            are available.
          </p>
          {realJobCount > 0 && (
            <p className="text-[14px] text-[var(--yu3-ink-muted)] mt-4 font-medium">
              {realJobCount === 1
                ? "One job is scheduled for your team today. It will show here after the check."
                : `${realJobCount} jobs are scheduled for your team today. They will show here after the check.`}
            </p>
          )}
        </div>
      </PageContent>
    );
  }

  const firstName = data.crewMember?.name?.split(/\s+/)[0] || "Crew";

  const completedCount = realJobs.filter(isCompleted).length;
  const totalCount = realJobs.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const now = new Date();
  const hour =
    typeof data.businessLocalHour === "number" &&
    data.businessLocalHour >= 0 &&
    data.businessLocalHour <= 23
      ? data.businessLocalHour
      : getLocalHourInAppTimezone(now);
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const scheduleFootnote =
    data.scheduleDateYmd && data.scheduleTimezone
      ? `${formatDateYmd(
          data.scheduleDateYmd,
          { weekday: "long", month: "short", day: "numeric" },
          data.scheduleTimezone,
        )} · ${data.scheduleTimezoneShort || data.scheduleTimezone}`
      : null;

  return (
    <PageContent className={pageContentClass}>
      <section className="w-full max-w-[520px] min-w-0 mx-auto">
        {/* Header + progress */}
        <header className="pb-2 mb-6 sm:mb-7">
          <div className="min-w-0">
            <p className="yu3-t-eyebrow mb-1.5 text-[10px] leading-none text-[var(--yu3-wine)] [font-family:var(--font-body)]">
              {data.crewMember?.teamName || "Team"}
            </p>
            <h1 className="font-hero text-[26px] sm:text-[28px] font-bold text-[var(--yu3-wine)] leading-[1.15] tracking-tight">
              {greeting}, {firstName}
            </h1>
            <p className="text-[14px] text-[var(--yu3-ink-muted)] mt-2.5 sm:mt-3">
              {scheduleFootnote ||
                data.crewMember?.dateStr ||
                formatDate(new Date(), {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
            </p>
            {data.crewMember?.role === "lead" && (
              <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-3 leading-relaxed max-w-[38ch]">
                Missing a job? Confirm your team and schedule date in dispatch.
              </p>
            )}

            {totalCount > 0 && (
              <div className="mt-8 pt-6 border-t border-[var(--yu3-line-subtle)]">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="yu3-t-eyebrow text-[10px] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
                    Day progress
                  </span>
                  <span className="text-[12px] font-bold text-[var(--yu3-ink)] tabular-nums">
                    {completedCount}/{totalCount}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--yu3-line)]/30 overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background:
                        progressPercent === 100
                          ? "linear-gradient(90deg, var(--yu3-forest) 0%, #243524 100%)"
                          : "linear-gradient(90deg, var(--yu3-forest) 0%, #3d5240 100%)",
                    }}
                  />
                </div>
                {progressPercent === 100 && (
                  <p className="text-[11px] font-semibold text-[var(--yu3-forest)] mt-3 [font-family:var(--font-body)]">
                    All jobs complete. Great work.
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
            <div className="py-12 text-center border-t border-b border-[var(--yu3-line-subtle)]">
              <p className="yu3-t-eyebrow text-[12px] text-[var(--yu3-ink)] mb-3 [font-family:var(--font-body)]">
                No jobs on the schedule
              </p>
              <p className="text-[14px] text-[var(--yu3-ink-muted)] leading-relaxed max-w-[32ch] mx-auto">
                Check back tomorrow or contact dispatch if this looks wrong.
              </p>
            </div>
          ) : (
            <div className="space-y-3 w-full min-w-0">
            {jobs.map((job, index) => {
              const isSample = isSampleJob(job);
              const completed = isCompleted(job);
              const statusKey = (job.status || "").toLowerCase();
              const forestCompleteBadge = [
                "completed",
                "delivered",
                "done",
              ].includes(statusKey);
              const inProgress = isInProgress(job);
              const canStart = canStartJob(index);
              const startBlockedReason = startJobBlockReason(index);
              const statusInfo = STATUS_MAP[statusKey];

              return (
                  <article
                    key={job.id}
                    className={`min-w-0 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 sm:p-5 shadow-[var(--yu3-shadow-sm)] ${
                      !completed && !inProgress && !canStart && !isSample
                        ? " opacity-[0.88]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1 flex items-start gap-2.5">
                        <div
                          className="shrink-0 w-7 sm:w-8 flex justify-center pt-0.5 tabular-nums"
                          style={{
                            color: completed
                              ? "var(--yu3-forest)"
                              : inProgress
                                ? "#B45309"
                                : "var(--yu3-wine)",
                          }}
                        >
                          {completed ? (
                            <Check
                              size={22}
                              weight="bold"
                              className="shrink-0"
                              aria-hidden
                            />
                          ) : (
                            <span className="text-[26px] sm:text-[28px] font-bold leading-none tracking-tight">
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[15px] font-semibold text-[var(--yu3-ink)] truncate block leading-snug">
                            {job.clientName}
                          </span>
                          <span className="text-[12px] font-semibold text-[var(--yu3-ink-muted)] font-mono tracking-tight block mt-0.5">
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
                        {isSample && (
                          <span className="px-2.5 py-1 rounded-md bg-[var(--yu3-wine)]/10 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)] [font-family:var(--font-body)] leading-none">
                            Sample
                          </span>
                        )}
                        {statusInfo ? (
                          <span
                            className={
                              forestCompleteBadge
                                ? "px-2.5 py-1 rounded-md bg-[var(--yu3-forest)]/[0.08] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink)] [font-family:var(--font-body)] leading-none"
                                : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                            }
                            style={
                              forestCompleteBadge
                                ? undefined
                                : {
                                    background: statusInfo.bg,
                                    color: statusInfo.color,
                                  }
                            }
                          >
                            {statusInfo.label}
                          </span>
                        ) : job.status ? (
                          <span
                            className={
                              forestCompleteBadge
                                ? "px-2.5 py-1 rounded-md bg-[var(--yu3-forest)]/[0.08] text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink)] [font-family:var(--font-body)] leading-none"
                                : "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]"
                            }
                          >
                            {getDisplayLabel(job.status, "status")}
                          </span>
                        ) : null}
                        <span className="text-[12px] font-semibold text-[var(--yu3-ink-muted)] tabular-nums">
                          {job.scheduledTime}
                        </span>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="flex gap-2.5">
                      {/* Dot + connector column */}
                      <div className="flex flex-col items-center shrink-0 pt-0.5">
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--yu3-wine)]/40 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--yu3-wine)]" />
                        </div>
                        <div
                          className="w-[2px] flex-1 my-1 rounded-full bg-[var(--yu3-line)]/50"
                          style={{ minHeight: 14 }}
                        />
                        <div className="w-4 h-4 rounded-full border-2 border-[var(--yu3-forest)]/40 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--yu3-forest)]" />
                        </div>
                      </div>
                      {/* Address text column */}
                      <div className="flex flex-col justify-between min-w-0 flex-1 gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-faint)] mb-0.5 [font-family:var(--font-body)] leading-none">
                            Pickup
                          </p>
                          <p className="text-[14px] text-[var(--yu3-ink)] font-medium leading-snug">
                            {job.fromAddress}
                          </p>
                          {job.fromAccessLine && (
                            <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1 leading-snug [font-family:var(--font-body)]">
                              {job.fromAccessLine}
                            </p>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-faint)] mb-0.5 [font-family:var(--font-body)] leading-none">
                            Drop-off
                          </p>
                          <p className="text-[14px] text-[var(--yu3-ink)] font-medium leading-snug">
                            {job.toAddress}
                          </p>
                          {job.toAccessLine && (
                            <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1 leading-snug [font-family:var(--font-body)]">
                              {job.toAccessLine}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Type + items */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-[var(--yu3-ink-faint)]">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--yu3-bg-surface-sunken)] font-medium text-[var(--yu3-ink-muted)]">
                        {job.jobTypeLabel}
                      </span>
                      {job.eventPhase && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider [font-family:var(--font-body)] ${
                            job.eventPhase === "delivery"
                              ? "bg-[color-mix(in_srgb,var(--yu3-c6)_18%,var(--yu3-bg-surface))] text-[var(--yu3-c6)]"
                              : job.eventPhase === "return"
                                ? "bg-[var(--yu3-forest-tint)] text-[var(--yu3-forest)]"
                                : "bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)]"
                          }`}
                        >
                          {job.eventPhase === "delivery"
                            ? "Event Delivery"
                            : job.eventPhase === "return"
                              ? "Event Return"
                              : "Event Setup"}
                        </span>
                      )}
                      {job.isRecurring && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[var(--yu3-neutral-tint)] text-[var(--yu3-ink-muted)]">
                          Recurring
                        </span>
                      )}
                      {job.itemCount != null && job.itemCount > 0 && (
                        <span>{job.itemCount} items</span>
                      )}
                    </div>

                    {/* Action area */}
                    <div className="mt-3">
                      {isSample ? (
                        <p className="text-[11px] font-semibold text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] py-2">
                          Preview only. Not a live job.
                        </p>
                      ) : completed ? (
                        <div className="flex flex-col gap-2 w-full">
                          {job.tipReportPending ? (
                            <Link
                              href={`/crew/dashboard/job/${job.jobType}/${job.id}/tip-report`}
                              className="group inline-flex items-center gap-1.5 min-h-[44px] py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] w-full sm:w-auto"
                            >
                              Tip report required
                              <CaretRight
                                size={14}
                                weight="bold"
                                className="shrink-0 text-[var(--yu3-ink-faint)] transition-colors group-hover:text-[var(--yu3-wine)]"
                                aria-hidden
                              />
                            </Link>
                          ) : null}
                          {job.postJobEquipmentComplete === false ? (
                            <Link
                              href={`/crew/dashboard/job/${job.jobType}/${job.id}/equipment-check`}
                              className="inline-flex items-center justify-center gap-1.5 min-h-[48px] py-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)] bg-[var(--yu3-wine-tint)]/80 border border-[var(--yu3-wine)]/25 hover:bg-[var(--yu3-wine-wash)] transition-colors [font-family:var(--font-body)] rounded-[var(--yu3-r-md)] w-full sm:w-auto"
                            >
                              Equipment check required
                              <CaretRight size={14} weight="bold" className="shrink-0" aria-hidden />
                            </Link>
                          ) : null}
                          <Link
                            href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] py-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-forest)] bg-[var(--yu3-forest-tint)]/60 hover:bg-[var(--yu3-forest-tint)] transition-colors [font-family:var(--font-body)] rounded-[var(--yu3-r-md)] w-full sm:w-auto"
                          >
                            View summary
                            <CaretRight
                              size={14}
                              weight="bold"
                              className="shrink-0"
                              aria-hidden
                            />
                          </Link>
                        </div>
                      ) : canStart ? (
                        <Link
                          href={`/crew/dashboard/job/${job.jobType}/${job.id}`}
                          className={`flex w-full items-center justify-center gap-2 min-h-[52px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] [font-family:var(--font-body)] crew-premium-cta ${
                            inProgress
                              ? ""
                              : "shadow-[0_4px_20px_rgba(92,26,51,0.12)]"
                          } text-[#FFFBF7]`}
                        >
                          {inProgress ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFFBF7] opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFFBF7]" />
                              </span>
                              Return to job
                            </>
                          ) : (
                            <>
                              Start job
                              <CaretRight
                                size={16}
                                weight="bold"
                                className="shrink-0"
                                aria-hidden
                              />
                            </>
                          )}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2 py-2 text-[11px] text-[var(--yu3-ink-faint)] leading-snug">
                          <Lock size={12} className="shrink-0 mt-0.5" aria-hidden />
                          <span>
                            {startBlockedReason === "equipment"
                              ? "Finish the post-job truck equipment check on an earlier job before starting this one."
                              : "Complete the previous job on the schedule first."}
                          </span>
                        </div>
                      )}
                    </div>
                  </article>
              );
            })}
            </div>
          )}
        </div>

        {/* End day button */}
        {realJobCount > 0 &&
          completedCount === totalCount &&
          (endOfDaySubmitted ? (
            <Link
              href="/crew/end-of-day"
              className="mt-8 flex items-center justify-center gap-1.5 min-h-[48px] py-2.5 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-forest)] bg-[var(--yu3-forest-tint)]/60 hover:bg-[var(--yu3-forest-tint)] transition-colors [font-family:var(--font-body)] rounded-[var(--yu3-r-md)] w-full sm:w-auto mx-auto"
            >
              <Check size={14} weight="bold" aria-hidden />
              Update end of day
              <CaretRight
                size={14}
                weight="bold"
                className="shrink-0"
                aria-hidden
              />
            </Link>
          ) : (
            <div className="mt-8 w-full max-w-md mx-auto">
              {eodPrerequisites && !eodPrerequisites.canSubmit ? (
                <p className="text-[12px] text-center text-[var(--yu3-ink-muted)] leading-relaxed mb-3 [font-family:var(--font-body)]">
                  Finish the tip report and post-job truck equipment check for each job before you can submit the end
                  of day report. Use the job cards above or open end of day to see the list.
                </p>
              ) : null}
              <Link
                href="/crew/end-of-day"
                className={
                  eodPrerequisites && !eodPrerequisites.canSubmit
                    ? "flex items-center justify-center gap-1.5 min-h-[52px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] border-2 border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] rounded-[var(--yu3-r-md)] w-full [font-family:var(--font-body)]"
                    : "crew-premium-cta flex items-center justify-center gap-1.5 min-h-[52px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors shadow-[0_4px_20px_rgba(44,62,45,0.18)] [font-family:var(--font-body)] w-full"
                }
              >
                <Check size={16} weight="bold" aria-hidden />
                {eodPrerequisites && !eodPrerequisites.canSubmit
                  ? "Review end of day"
                  : "Complete your day"}
                <CaretRight size={16} weight="bold" className="shrink-0" aria-hidden />
              </Link>
            </div>
          ))}
        {realJobCount > 0 && completedCount < totalCount && (
          <Link
            href="/crew/end-of-day"
            className="mt-8 flex items-center justify-center gap-1 min-h-[48px] py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-forest)] transition-colors [font-family:var(--font-body)]"
          >
            End day report
            <CaretRight
              size={14}
              weight="bold"
              className="shrink-0 opacity-80"
              aria-hidden
            />
          </Link>
        )}

        {data.hasActiveBinTasks && (
          <Link
            href="/crew/bin-orders"
            className="mt-4 flex items-center justify-center gap-2 min-h-[48px] py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink-muted)] border border-[var(--yu3-line-subtle)] hover:border-[var(--yu3-forest)]/35 hover:bg-[var(--yu3-forest)]/[0.04] hover:text-[var(--yu3-forest)] transition-colors [font-family:var(--font-body)]"
          >
            <Recycle size={16} aria-hidden />
            Bin tasks
            <CaretRight
              size={14}
              weight="bold"
              className="shrink-0"
              aria-hidden
            />
          </Link>
        )}
      </section>
    </PageContent>
  );
}
