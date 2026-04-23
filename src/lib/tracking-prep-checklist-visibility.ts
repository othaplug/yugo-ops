import { DELIVERY_STATUS_FLOW, MOVE_STATUS_FLOW } from "@/lib/crew-tracking-status"

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")

/**
 * Client-facing prep checklist: show until the crew has actually arrived at pickup
 * (stages at or after `arrived_at_pickup` hide it). While en route to pickup it stays visible.
 */
export const shouldShowClientPreMoveChecklist = (
  liveStage: string | null | undefined,
  moveStage: string | null | undefined,
  job: "move" | "delivery",
): boolean => {
  const s = norm(liveStage || moveStage)
  if (!s) return true

  if (s === "on_route" || s === "en_route") return true

  const flow = job === "delivery" ? DELIVERY_STATUS_FLOW : MOVE_STATUS_FLOW
  const i = flow.indexOf(s as (typeof flow)[number])
  if (i < 0) {
    if (
      [
        "confirmed",
        "scheduled",
        "booked",
        "in_progress",
        "dispatched",
        "pre_move",
        "en_route",
      ].includes(s)
    ) {
      return true
    }
    return true
  }
  return i < 1
}
