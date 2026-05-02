/**
 * Admin Create Move sends `project_schedule` JSON alongside `estimated_days`.
 * Persisted onto `move_project_days` rows (additive; validated server-side).
 */

export type PackingRoomsPayload = Partial<
  Record<
    | "kitchen"
    | "living"
    | "bedrooms"
    | "dining"
    | "garage"
    | "storage",
    boolean
  >
>

export type MoveProjectScheduleDayPayload = {
  day: number
  type: string
  date: string
  start_time?: string | null
  estimated_hours?: number | null
  crew_size?: number | null
  crew_member_ids?: string[]
  truck?: string | null
  notes?: string | null
  packing_rooms?: PackingRoomsPayload | null
}

export type MoveProjectSchedulePayload = {
  days: MoveProjectScheduleDayPayload[]
}

const PACK_KEYS = [
  "kitchen",
  "living",
  "bedrooms",
  "dining",
  "garage",
  "storage",
] as const

export const sanitizeMoveProjectSchedulePayload = (
  raw: unknown,
  maxDays: number,
): MoveProjectSchedulePayload | null => {
  if (!raw || typeof raw !== "object") return null
  const o = raw as { days?: unknown }
  if (!Array.isArray(o.days) || o.days.length === 0) return null
  const days: MoveProjectScheduleDayPayload[] = []
  const cap = Math.max(1, Math.min(14, maxDays))
  for (const entry of o.days.slice(0, cap)) {
    if (!entry || typeof entry !== "object") continue
    const d = entry as Record<string, unknown>
    const dayNum = typeof d.day === "number" && Number.isFinite(d.day) ? Math.round(d.day) : NaN
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > cap) continue
    const typ = typeof d.type === "string" ? d.type.toLowerCase().trim().slice(0, 24) : "move"
    const dateStr = typeof d.date === "string" ? d.date.trim().slice(0, 16) : ""
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue
    const packingRooms: PackingRoomsPayload | null =
      d.packing_rooms && typeof d.packing_rooms === "object" && !Array.isArray(d.packing_rooms)
        ? {}
        : null
    if (packingRooms && d.packing_rooms && typeof d.packing_rooms === "object") {
      for (const k of PACK_KEYS) {
        if (Object.prototype.hasOwnProperty.call(d.packing_rooms, k)) {
          packingRooms[k] = Boolean((d.packing_rooms as Record<string, unknown>)[k])
        }
      }
    }

    let crewMemberIds: string[] = []
    if (Array.isArray(d.crew_member_ids)) {
      crewMemberIds = d.crew_member_ids
        .filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x.trim()))
        .map((x) => x.trim())
    }

    days.push({
      day: dayNum,
      type: typ,
      date: dateStr,
      start_time:
        typeof d.start_time === "string" && d.start_time.trim()
          ? d.start_time.trim().slice(0, 16)
          : null,
      estimated_hours:
        typeof d.estimated_hours === "number" && Number.isFinite(d.estimated_hours)
          ? Math.max(0.5, Math.min(24, d.estimated_hours))
          : null,
      crew_size:
        typeof d.crew_size === "number" && Number.isFinite(d.crew_size)
          ? Math.max(1, Math.min(20, Math.round(d.crew_size)))
          : null,
      crew_member_ids: crewMemberIds.length > 0 ? crewMemberIds : [],
      truck:
        typeof d.truck === "string" && d.truck.trim() ? d.truck.trim().slice(0, 32) : null,
      notes: typeof d.notes === "string" ? d.notes.trim().slice(0, 2000) : null,
      packing_rooms: packingRooms && Object.keys(packingRooms).length ? packingRooms : null,
    })
  }
  return days.length > 0 ? { days } : null
}
