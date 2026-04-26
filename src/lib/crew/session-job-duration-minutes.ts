/**
 * Wall-clock job duration for a completed tracking session.
 * The checkpoints array is not always in chronological order (e.g. idle / off-route
 * notes), so we must not use only the last element. Prefer `completed_at`, then the
 * latest timestamp in checkpoints, then fallbacks.
 */
type SessionForDuration = {
  status?: string | null
  started_at?: string | null
  completed_at?: string | null
  updated_at?: string | null
  checkpoints?: unknown
}

export const sessionJobDurationMinutes = (session: SessionForDuration): number => {
  const startMs = session.started_at ? new Date(session.started_at).getTime() : NaN
  if (!Number.isFinite(startMs)) return 0

  const cps = Array.isArray(session.checkpoints) ? session.checkpoints : []
  let maxCpMs = 0
  for (const c of cps) {
    if (c && typeof c === "object" && "timestamp" in c) {
      const raw = (c as { timestamp?: string }).timestamp
      if (raw) {
        const ms = new Date(raw).getTime()
        if (Number.isFinite(ms)) maxCpMs = Math.max(maxCpMs, ms)
      }
    }
  }
  const last = cps.length > 0 ? cps[cps.length - 1] : null
  const lastMs =
    last && typeof last === "object" && "timestamp" in last
      ? new Date((last as { timestamp?: string }).timestamp || 0).getTime()
      : NaN

  const status = (session.status || "").toLowerCase()
  const completedAtMs = session.completed_at
    ? new Date(session.completed_at).getTime()
    : NaN
  const updatedAtMs = session.updated_at
    ? new Date(session.updated_at).getTime()
    : NaN

  let endMs: number
  if (status === "completed" && Number.isFinite(completedAtMs)) {
    endMs = Math.max(completedAtMs, maxCpMs, Number.isFinite(lastMs) ? lastMs : 0)
  } else if (maxCpMs > 0) {
    endMs = maxCpMs
  } else if (Number.isFinite(completedAtMs)) {
    endMs = completedAtMs
  } else if (Number.isFinite(lastMs)) {
    endMs = lastMs
  } else if (Number.isFinite(updatedAtMs)) {
    endMs = updatedAtMs
  } else {
    endMs = Date.now()
  }

  return Math.max(0, Math.round((endMs - startMs) / 60_000))
}
