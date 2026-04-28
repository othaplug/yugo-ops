import type { SupabaseClient } from "@supabase/supabase-js"
import { DELIVERY_B2B_STATUS_FLOW } from "@/lib/crew/service-type-flow"
import { applyCheckpointProgressToJobRow } from "@/lib/moves/complete-move-job"
import { isTerminalJobStatus } from "@/lib/moves/job-terminal"
import { normalizeDeliveryStatus, type TrackingStatus } from "@/lib/crew-tracking-status"
import { notifyOnCheckpoint } from "@/lib/tracking-notifications"
import {
  recordDeliveryTrackingNotifyDedupe,
  shouldSkipDuplicateDeliveryTrackingNotify,
} from "@/lib/tracking-notify-dedupe"

export type MultiStopCheckpoint = Extract<
  TrackingStatus,
  "en_route_to_destination" | "arrived_at_destination"
>

/** True when this stop row is the client drop-off leg (B2B multi-stop). */
export const isFinalDropStopRow = (row: {
  is_final_destination?: boolean | null
  stop_type?: string | null
}): boolean => {
  if (row.is_final_destination) return true
  const t = String(row.stop_type || "").toLowerCase()
  return t === "delivery" || t === "dropoff"
}

type StopLike = {
  stop_status?: string | null
  status?: string | null
  stop_type?: string | null
  is_final_destination?: boolean | null
}

/**
 * Map sequential crew stop states to a tracking_sessions / deliveries.stage status for B2B multi-stop.
 */
export function deriveMultiStopTrackingStatusFromStops(stops: StopLike[]): TrackingStatus | null {
  if (!stops.length) return null
  const normalized = stops.map((s) => ({
    ...s,
    ss: String(s.stop_status || s.status || "pending").toLowerCase(),
  }))
  const active = normalized.find((s) => ["current", "arrived", "in_progress"].includes(s.ss))
  const allDone = normalized.every((s) => s.ss === "completed" || s.ss === "skipped")
  if (allDone) return "completed"
  if (!active) return null

  const finalLeg = isFinalDropStopRow(active)
  if (active.ss === "current") {
    return finalLeg ? "en_route_to_destination" : "en_route_to_pickup"
  }
  if (active.ss === "arrived") {
    return finalLeg ? "arrived_at_destination" : "arrived_at_pickup"
  }
  if (active.ss === "in_progress") {
    return finalLeg ? "unloading" : "loading"
  }
  return null
}

function multiStopTrackingRank(status: string): number {
  const n = normalizeDeliveryStatus(status) as TrackingStatus
  const i = DELIVERY_B2B_STATUS_FLOW.indexOf(n)
  return i >= 0 ? i : -1
}

const stageAheadOf = (current: string, target: MultiStopCheckpoint): boolean => {
  const order = [
    "en_route_to_pickup",
    "arrived_at_pickup",
    "loading",
    "en_route_to_destination",
    "arrived_at_destination",
    "unloading",
    "delivering",
    "completed",
  ]
  const iCur = order.indexOf(current)
  const iTgt = order.indexOf(target)
  if (iCur < 0 || iTgt < 0) return false
  return iCur > iTgt
}

/**
 * Create an active delivery tracking session when the crew opens a multi-stop job or hits the first
 * current stop, so the live map and timeline stay populated without using Start tracking.
 */
export async function ensureMultiStopDeliveryTrackingSessionFromStops(
  admin: SupabaseClient,
  params: { deliveryId: string; teamId: string; crewLeadId: string | null },
): Promise<void> {
  const { deliveryId, teamId, crewLeadId } = params
  const { data: d } = await admin
    .from("deliveries")
    .select("id, status, crew_id, is_multi_stop")
    .eq("id", deliveryId)
    .maybeSingle()

  if (!d?.is_multi_stop || d.crew_id !== teamId) return
  if (isTerminalJobStatus(String(d.status || ""), "delivery")) return

  const { data: existing } = await admin
    .from("tracking_sessions")
    .select("id")
    .eq("job_id", deliveryId)
    .eq("job_type", "delivery")
    .eq("is_active", true)
    .maybeSingle()

  if (existing) return

  const { data: stops } = await admin
    .from("delivery_stops")
    .select("stop_status, status, stop_type, is_final_destination")
    .eq("delivery_id", deliveryId)
    .order("stop_number")

  const derived = deriveMultiStopTrackingStatusFromStops(stops || [])
  if (!derived || derived === "completed") return

  const now = new Date().toISOString()
  const checkpoint = {
    status: derived,
    timestamp: now,
    lat: null,
    lng: null,
    note: "Multi-stop session (auto)",
  }

  const { error: insErr } = await admin.from("tracking_sessions").insert({
    job_id: deliveryId,
    job_type: "delivery",
    team_id: teamId,
    crew_lead_id: crewLeadId,
    status: derived,
    is_active: true,
    started_at: now,
    checkpoints: [checkpoint],
  })

  if (insErr) {
    console.error("[multi-stop-tracking] session insert:", insErr.message)
    return
  }

  await admin
    .from("deliveries")
    .update({ eta_tracking_active: true, updated_at: now })
    .eq("id", deliveryId)

  await applyCheckpointProgressToJobRow(admin, {
    jobId: deliveryId,
    jobType: "delivery",
    checkpointStatus: derived,
    now,
  })
}

/**
 * Advance tracking session checkpoints when stop flow moves ahead of the session (live map parity).
 */
export async function reconcileMultiStopDeliveryTrackingSessionFromStops(
  admin: SupabaseClient,
  deliveryId: string,
): Promise<void> {
  const { data: d } = await admin
    .from("deliveries")
    .select("id, status, is_multi_stop")
    .eq("id", deliveryId)
    .maybeSingle()

  if (!d?.is_multi_stop || isTerminalJobStatus(String(d.status || ""), "delivery")) return

  const { data: stops } = await admin
    .from("delivery_stops")
    .select("stop_status, status, stop_type, is_final_destination")
    .eq("delivery_id", deliveryId)
    .order("stop_number")

  const derived = deriveMultiStopTrackingStatusFromStops(stops || [])
  if (!derived) return

  const { data: sess } = await admin
    .from("tracking_sessions")
    .select("id, status, checkpoints")
    .eq("job_id", deliveryId)
    .eq("job_type", "delivery")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sess) return

  const now = new Date().toISOString()
  const curNorm = normalizeDeliveryStatus(String(sess.status || ""))
  const derNorm = normalizeDeliveryStatus(derived)

  if (derived === "completed") {
    if (curNorm === "completed") return
    const prev = Array.isArray(sess.checkpoints) ? [...sess.checkpoints] : []
    prev.push({ status: "completed", timestamp: now, note: "Multi-stop all stops done" })
    await admin
      .from("tracking_sessions")
      .update({
        status: "completed",
        checkpoints: prev,
        updated_at: now,
        is_active: false,
        completed_at: now,
      })
      .eq("id", sess.id)
    return
  }

  if (multiStopTrackingRank(derNorm) <= multiStopTrackingRank(curNorm)) return

  const prev = Array.isArray(sess.checkpoints) ? [...sess.checkpoints] : []
  prev.push({
    status: derNorm,
    timestamp: now,
    note: "Synced from multi-stop stops",
  })
  await admin
    .from("tracking_sessions")
    .update({
      status: derNorm,
      checkpoints: prev,
      updated_at: now,
    })
    .eq("id", sess.id)
}

export async function ensureAndReconcileMultiStopDeliveryTrackingSession(
  admin: SupabaseClient,
  params: { deliveryId: string; teamId: string; crewLeadId: string | null },
): Promise<void> {
  await ensureMultiStopDeliveryTrackingSessionFromStops(admin, params)
  await reconcileMultiStopDeliveryTrackingSessionFromStops(admin, params.deliveryId)
}

/**
 * Syncs deliveries.stage and client comms when the crew reaches the final drop-off leg in B2B multi-stop.
 * Session timeline is updated via {@link reconcileMultiStopDeliveryTrackingSessionFromStops}.
 */
export async function syncMultiStopDeliveryClientCheckpoint(
  admin: SupabaseClient,
  params: { deliveryId: string; checkpointStatus: MultiStopCheckpoint },
): Promise<void> {
  const { deliveryId, checkpointStatus } = params
  const now = new Date().toISOString()

  const { data: d } = await admin
    .from("deliveries")
    .select(
      "id, status, stage, is_multi_stop, crew_id, customer_name, client_name, pickup_address, delivery_address, delivery_number",
    )
    .eq("id", deliveryId)
    .maybeSingle()

  if (!d?.is_multi_stop) return
  if (isTerminalJobStatus(String(d.status || ""), "delivery")) return

  const stage = String(d.stage || "").toLowerCase()
  if (stage === String(checkpointStatus)) return
  if (stageAheadOf(stage, checkpointStatus)) return

  await applyCheckpointProgressToJobRow(admin, {
    jobId: deliveryId,
    jobType: "delivery",
    checkpointStatus,
    now,
  })

  const crewId = d.crew_id as string | null
  let teamName = "Crew"
  if (crewId) {
    const { data: crew } = await admin.from("crews").select("name").eq("id", crewId).maybeSingle()
    if (crew?.name) teamName = crew.name
  }

  const jobName =
    `${d.customer_name || ""}${d.client_name ? ` (${d.client_name})` : ""}`.trim() ||
    d.delivery_number ||
    deliveryId

  const skipNotify = await shouldSkipDuplicateDeliveryTrackingNotify(admin, deliveryId, checkpointStatus)
  if (!skipNotify) {
    try {
      await notifyOnCheckpoint(
        checkpointStatus,
        deliveryId,
        "delivery",
        teamName,
        jobName,
        d.pickup_address || undefined,
        d.delivery_address || undefined,
      )
      await recordDeliveryTrackingNotifyDedupe(admin, deliveryId, checkpointStatus)
    } catch (e) {
      console.error("[multi-stop-tracking] notify:", e)
    }
  }
}
