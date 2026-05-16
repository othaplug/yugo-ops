/**
 * In-job operational alerts: margin runway vs allocated time, using the same
 * internal cost snapshot as pricing (estimated_internal_cost at booking).
 */

import {
  DELIVERY_STATUS_FLOW,
  MOVE_STATUS_FLOW,
  normalizeDeliveryStatus,
  type TrackingStatus,
} from "@/lib/crew-tracking-status"

export type OperationalJobAlerts = {
  /** True when projected margin dollars fall below 50% of original planned margin */
  marginBelowHalf: boolean
  /** True when linear projection of finish exceeds allocated duration, or elapsed already exceeds allocated */
  projectedFinishAfterAllocated: boolean
  /** Minutes from job start to projected end (null if cannot estimate) */
  projectedTotalMinutes: number | null
  /** Revenue minus cost scaled by projected duration / allocated */
  projectedMarginDollars: number | null
  /** Planned margin at booking: revenue − estimated internal cost */
  originalMarginDollars: number | null
  allocatedMinutes: number | null
  elapsedMinutes: number | null
}

function statusProgressFraction(
  status: string | null | undefined,
  jobType: "move" | "delivery",
): number | null {
  const raw = (status || "").trim()
  if (!raw) return null
  const flow =
    jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW
  const st =
    jobType === "delivery" ? normalizeDeliveryStatus(raw) : (raw as TrackingStatus)
  const idx = flow.indexOf(st as TrackingStatus)
  if (idx < 0) return null
  return (idx + 1) / flow.length
}

/**
 * @param grossRevenue — job price (e.g. move.estimate)
 * @param estimatedInternalCost — snapshot from pricing engine at creation
 * @param allocatedMinutes — estimated_duration_minutes
 * @param elapsedMinutes — wall time since tracking session start
 * @param trackingStatus — latest checkpoint status from tracking_sessions
 */
export function computeOperationalJobAlerts(input: {
  jobType: "move" | "delivery"
  grossRevenue: number
  estimatedInternalCost: number | null
  allocatedMinutes: number | null
  elapsedMinutes: number | null
  trackingStatus: string | null
}): OperationalJobAlerts {
  const revenue = Math.max(0, input.grossRevenue)
  const C0 =
    input.estimatedInternalCost != null &&
    Number.isFinite(input.estimatedInternalCost)
      ? Math.max(0, Number(input.estimatedInternalCost))
      : null
  const allocated =
    input.allocatedMinutes != null &&
    Number.isFinite(input.allocatedMinutes) &&
    input.allocatedMinutes > 0
      ? Math.round(input.allocatedMinutes)
      : null
  const elapsed =
    input.elapsedMinutes != null &&
    Number.isFinite(input.elapsedMinutes) &&
    input.elapsedMinutes >= 0
      ? input.elapsedMinutes
      : null

  const M0 =
    C0 != null && revenue > 0 ? Math.max(0, revenue - C0) : null

  if (allocated == null || elapsed == null) {
    return {
      marginBelowHalf: false,
      projectedFinishAfterAllocated: false,
      projectedTotalMinutes: null,
      projectedMarginDollars: null,
      originalMarginDollars: M0,
      allocatedMinutes: allocated,
      elapsedMinutes: elapsed,
    }
  }

  const rawP = statusProgressFraction(input.trackingStatus, input.jobType)
  let projectedTotal: number
  if (rawP != null && rawP > 0) {
    const p = Math.min(1, rawP)
    // Cap projection at 3× allocated to avoid absurd values
    const maxSanity = Math.max(allocated * 3, elapsed + allocated)
    projectedTotal = Math.min(elapsed / p, maxSanity)
  } else {
    // Status unknown — can't extrapolate, use elapsed as lower bound
    projectedTotal = elapsed
  }

  const scheduleOver =
    elapsed >= allocated || projectedTotal > allocated

  let projectedMargin: number | null = null
  let marginHalf = false
  if (C0 != null && revenue > 0 && allocated > 0) {
    const scale = projectedTotal / allocated
    projectedMargin = revenue - C0 * scale
    if (M0 != null && M0 > 0) {
      marginHalf = projectedMargin < 0.5 * M0
    } else if (M0 === 0) {
      marginHalf = projectedMargin < 0
    }
  }

  return {
    marginBelowHalf: marginHalf,
    projectedFinishAfterAllocated: scheduleOver,
    projectedTotalMinutes: Math.round(projectedTotal),
    projectedMarginDollars:
      projectedMargin != null ? Math.round(projectedMargin * 100) / 100 : null,
    originalMarginDollars: M0 != null ? Math.round(M0 * 100) / 100 : null,
    allocatedMinutes: allocated,
    elapsedMinutes: Math.round(elapsed * 10) / 10,
  }
}
