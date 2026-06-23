import { DELIVERY_STATUS_FLOW, MOVE_STATUS_FLOW } from "@/lib/crew-tracking-status"
import { isFullRelocationMove } from "@/lib/track-non-move-product"

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")

/**
 * Whether a job should get the client pre-move checklist at all.
 *
 * The checklist is transport-move prep (parking at BOTH locations, elevator
 * booking, disconnect appliances, etc.). It only applies to FULL residential
 * or commercial relocations — single-item runs, deliveries, bin rentals,
 * events, specialty, labour-only, and white-glove jobs don't have any
 * client-side prep to track.
 *
 * Also returns false when from and to are the same address (in-home job).
 */
export const moveUsesPreMoveChecklist = (opts: {
  serviceType?: string | null
  moveType?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  whiteGloveKind?: string | null
}): boolean => {
  if (!isFullRelocationMove({
    serviceType: opts.serviceType,
    whiteGloveKind: opts.whiteGloveKind,
  })) return false
  const from = String(opts.fromAddress ?? "").trim().toLowerCase()
  const to = String(opts.toAddress ?? "").trim().toLowerCase()
  if (from && to && from === to) return false
  return true
}

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
