import { getAppTimezone, ymdPartsInTimeZone } from "@/lib/business-timezone"

/**
 * Wall-clock *worked* duration for a tracking session, in minutes.
 *
 * A multi-day office/project job runs as ONE tracking session that only closes
 * at final sign-off, so a naive `completed_at - started_at` counts the overnight
 * gap between days as if the crew were working (e.g. MV-30348 showed 36.9h when
 * the two work days summed to ~26h). To avoid that, every timestamp (start,
 * checkpoints, resolved end) is bucketed by business calendar day and each day's
 * first→last span is summed — the idle overnight window between days is never
 * counted. Single-day jobs collapse to the usual end−start.
 *
 * The checkpoints array is not always chronological (idle/off-route notes), so
 * we take the max timestamp for the end rather than the last element.
 */
type SessionForDuration = {
  status?: string | null
  started_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
  checkpoints?: unknown
}

export const sessionJobDurationMinutes = (
  session: SessionForDuration,
  timeZone?: string,
): number => {
  const tz = timeZone || getAppTimezone()
  const startMs = session.started_at ? new Date(session.started_at).getTime() : NaN
  if (!Number.isFinite(startMs)) return 0

  const times: number[] = [startMs]
  const cps = Array.isArray(session.checkpoints) ? session.checkpoints : []
  let maxCpMs = 0
  for (const c of cps) {
    if (c && typeof c === "object" && "timestamp" in c) {
      const raw = (c as { timestamp?: string }).timestamp
      if (raw) {
        const ms = new Date(raw).getTime()
        if (Number.isFinite(ms)) {
          times.push(ms)
          maxCpMs = Math.max(maxCpMs, ms)
        }
      }
    }
  }

  const status = (session.status || "").toLowerCase()
  const completedAtMs = session.completed_at
    ? new Date(session.completed_at).getTime()
    : NaN
  const updatedAtMs = session.updated_at
    ? new Date(session.updated_at).getTime()
    : NaN

  let endMs: number
  if (status === "completed" && Number.isFinite(completedAtMs)) {
    endMs = Math.max(completedAtMs, maxCpMs)
  } else if (maxCpMs > 0) {
    endMs = maxCpMs
  } else if (Number.isFinite(completedAtMs)) {
    endMs = completedAtMs
  } else if (Number.isFinite(updatedAtMs)) {
    endMs = updatedAtMs
  } else {
    endMs = Date.now()
  }
  times.push(endMs)

  // Bucket by business-day and sum each day's first→last span so overnight gaps
  // between work days aren't counted.
  const byDay = new Map<string, { min: number; max: number }>()
  for (const ms of times) {
    if (!Number.isFinite(ms)) continue
    const day = ymdPartsInTimeZone(ms, tz)
    const cur = byDay.get(day)
    if (!cur) byDay.set(day, { min: ms, max: ms })
    else {
      cur.min = Math.min(cur.min, ms)
      cur.max = Math.max(cur.max, ms)
    }
  }

  let totalMs = 0
  for (const { min, max } of byDay.values()) totalMs += max - min
  return Math.max(0, Math.round(totalMs / 60_000))
}
