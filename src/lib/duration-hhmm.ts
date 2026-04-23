/**
 * Display and parse allocated job duration as hours:minutes (e.g. 6:00, 2:30).
 * Storage remains whole minutes in the database.
 */

/** e.g. 360 -> "6:00", 90 -> "1:30", 7 -> "0:07" */
export const formatMinutesAsHhMm = (totalMinutes: number): string => {
  const m = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${h}:${String(min).padStart(2, "0")}`
}

export type ParseHhMmResult =
  | { ok: true; minutes: number }
  | { ok: false; message: string }

/**
 * Accepts "6:00", "2:30", "0:45" (optional spaces). Minutes part 0–59; total capped at 24h.
 */
export const parseHhMmToMinutes = (raw: string): ParseHhMmResult => {
  const s = raw.trim()
  if (!s) return { ok: false, message: "Enter a duration or leave blank to clear." }
  const m = s.match(/^\s*(\d{1,3})\s*:\s*(\d{1,2})\s*$/)
  if (!m) {
    return {
      ok: false,
      message: 'Use hours:minutes, for example 6:00 or 2:30.',
    }
  }
  const h = Number.parseInt(m[1], 10)
  const min = Number.parseInt(m[2], 10)
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) {
    return { ok: false, message: "Minutes after the colon must be between 0 and 59." }
  }
  if (h < 0 || h > 24) {
    return { ok: false, message: "Hours must be between 0 and 24." }
  }
  const minutes = h * 60 + min
  if (minutes < 1) {
    return { ok: false, message: "Allocated time must be at least 0:01." }
  }
  if (minutes > 24 * 60) {
    return { ok: false, message: "Allocated time cannot exceed 24:00." }
  }
  return { ok: true, minutes }
}
