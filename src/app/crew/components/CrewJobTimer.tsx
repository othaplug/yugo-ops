"use client"

import { useMemo } from "react"
import { formatTime } from "@/lib/client-timezone"
import type { OperationalJobAlerts } from "@/lib/jobs/operational-alerts"
import { formatMinutesAsHhMm } from "@/lib/duration-hhmm"

type Props = {
  /** Wall-clock elapsed from job start (ms) */
  elapsedMs: number
  estimatedMinutes: number
  /** Legacy threshold; used only when operationalAlerts is absent */
  marginAlertMinutes: number
  /** Tracking session start (ISO); fills Start / Est. finish when set */
  startedAtIso?: string | null
  /** Server-computed margin + schedule risk (preferred) */
  operationalAlerts?: OperationalJobAlerts | null
}

function formatClockLabel(d: Date): string {
  return formatTime(d, { hour: "numeric", minute: "2-digit" })
}

/**
 * Light-surface card: explicit zinc ink so it stays readable on the crew dark shell.
 */
export default function CrewJobTimer({
  elapsedMs,
  estimatedMinutes,
  marginAlertMinutes,
  startedAtIso = null,
  operationalAlerts = null,
}: Props) {
  const elapsedMin = useMemo(
    () => Math.max(0, elapsedMs / 60000),
    [elapsedMs],
  )

  const target = Math.max(1, estimatedMinutes)
  const percentUsed = Math.min(100, Math.round((elapsedMin / target) * 100))

  const showMarginBanner = operationalAlerts
    ? operationalAlerts.marginBelowHalf
    : elapsedMin > marginAlertMinutes

  const showTimeBanner = operationalAlerts
    ? operationalAlerts.projectedFinishAfterAllocated
    : elapsedMin > target

  const remainMin = Math.max(0, Math.round(target - elapsedMin))

  const barFill = showMarginBanner
    ? "bg-red-500"
    : showTimeBanner
      ? "bg-amber-500"
      : "bg-[var(--yu3-wine)]"

  const shellClass = showMarginBanner
    ? "border-red-500/25 bg-[var(--yu3-bg-surface)]"
    : showTimeBanner
      ? "border-amber-500/30 bg-[var(--yu3-bg-surface)]"
      : "border-[var(--yu3-wine)]/10 bg-[var(--yu3-bg-surface)]"

  const startFinish = useMemo(() => {
    const raw = startedAtIso?.trim()
    if (!raw) {
      return {
        startLabel: null as string | null,
        finishLabel: null as string | null,
      }
    }
    const t0 = new Date(raw)
    if (Number.isNaN(t0.getTime())) {
      return { startLabel: null, finishLabel: null }
    }
    const t1 = new Date(t0.getTime() + target * 60000)
    return {
      startLabel: formatClockLabel(t0),
      finishLabel: formatClockLabel(t1),
    }
  }, [startedAtIso, target])

  const primaryHhMm = startedAtIso
    ? formatMinutesAsHhMm(remainMin)
    : formatMinutesAsHhMm(Math.round(target))
  const primarySuffix = startedAtIso ? "time left" : "planned"

  return (
    <div
      data-job-time-tracker
      className={`mb-4 overflow-hidden rounded-[20px] border border-[var(--yu3-line-subtle)] shadow-[var(--yu3-shadow-md)] [color-scheme:light] ${shellClass}`}
      aria-label="Job time tracker"
    >
      {(showMarginBanner || showTimeBanner) && (
        <div
          className={`space-y-1 px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.12em] [font-family:var(--font-body)] ${
            showMarginBanner
              ? "bg-red-500/10 text-red-800"
              : "bg-amber-500/12 text-amber-950"
          }`}
        >
          {showMarginBanner && (
            <p className="leading-snug">
              Projected profit margin below half of plan. Notify dispatch.
            </p>
          )}
          {showTimeBanner && (
            <p className="leading-snug">
              Projected finish beyond allocated time
              {operationalAlerts?.projectedTotalMinutes != null
                ? ` (~${formatMinutesAsHhMm(Math.round(operationalAlerts.projectedTotalMinutes))} total)`
                : ""}
              .
            </p>
          )}
        </div>
      )}

      <div className="px-4 pt-3">
        <div className="h-[2px] w-full overflow-hidden rounded-full bg-[var(--yu3-line-subtle)]">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${barFill}`}
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-5 pb-1 pt-4">
        <div className="min-w-0 text-left">
          <p className="mb-1.5 text-[10px] font-medium uppercase leading-none tracking-[0.22em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
            Start
          </p>
          <p className="text-[15px] font-semibold leading-tight tracking-[-0.02em] text-[var(--yu3-ink)] tabular-nums [font-family:var(--font-body)]">
            {startFinish.startLabel ?? (
              <span className="font-medium text-[var(--yu3-ink-faint)]">Not started</span>
            )}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="mb-1.5 text-[10px] font-medium uppercase leading-none tracking-[0.22em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">
            Est. finish
          </p>
          <p className="text-[15px] font-semibold leading-tight tracking-[-0.02em] text-[var(--yu3-ink)] tabular-nums [font-family:var(--font-body)]">
            {startFinish.finishLabel ?? (
              <span className="font-medium text-[var(--yu3-ink-faint)]">Not started</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-baseline justify-center gap-1.5 px-5 pb-3 pt-2">
        <span
          className={`text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums [font-family:var(--font-body)] sm:text-[36px] ${
            showMarginBanner
              ? "text-red-600"
              : showTimeBanner
                ? "text-amber-600"
                : "text-[var(--yu3-wine)]"
          }`}
        >
          {primaryHhMm}
        </span>
        <span className="pb-0.5 text-[11px] font-medium text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
          {primarySuffix}
        </span>
      </div>

      <div className="mx-5 h-px bg-[var(--yu3-line-subtle)]" aria-hidden />

      <p className="px-5 py-2.5 text-center text-[10px] font-medium leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
        {showMarginBanner ? (
          <span className="text-red-700/95">
            Internal model projects less than half of planned margin dollars at this pace.
          </span>
        ) : showTimeBanner ? (
          <span className="text-amber-900/95">
            Job is tracking past the allocated window. Finish critical path first.
          </span>
        ) : !startedAtIso ? (
          <span className="text-[var(--yu3-ink-muted)]">
            Est. finish appears once the job timer has started.
          </span>
        ) : remainMin <= 15 && remainMin > 0 ? (
          <span className="text-amber-900/90">
            Only {formatMinutesAsHhMm(remainMin)} left at planned pace
          </span>
        ) : (
          <span className="text-[var(--yu3-ink-muted)]">
            {percentUsed}% of allocated window used ·{" "}
            {formatMinutesAsHhMm(Math.round(target))} allocated
          </span>
        )}
      </p>
    </div>
  )
}
