/**
 * Staff notifications for in-job operational alerts (margin runway, schedule risk).
 * Deduped with per-job timestamps; repeat at most every RENOTIFY_COOLDOWN_MS while alert persists.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { notifyAdmins } from "@/lib/notifications/dispatch"
import type { OperationalJobAlerts } from "@/lib/jobs/operational-alerts"
import { formatMinutesAsHhMm } from "@/lib/duration-hhmm"

const RENOTIFY_COOLDOWN_MS = 6 * 60 * 60 * 1000

function isTerminalMoveStatus(s: string | null | undefined): boolean {
  const t = (s || "").toLowerCase()
  return t === "completed" || t === "cancelled" || t === "delivered"
}

function isTerminalDeliveryStatus(s: string | null | undefined): boolean {
  const t = (s || "").toLowerCase()
  return (
    t === "completed" ||
    t === "cancelled" ||
    t === "delivered" ||
    t === "closed"
  )
}

function shouldSend(now: number, lastSent: string | null | undefined): boolean {
  if (!lastSent) return true
  const t = new Date(lastSent).getTime()
  if (!Number.isFinite(t)) return true
  return now - t >= RENOTIFY_COOLDOWN_MS
}

/**
 * Fire-and-forget: notify admins when operational alerts are active, with cooldown per alert type.
 */
export const maybeNotifyOperationalInJobAlerts = async (input: {
  jobType: "move" | "delivery"
  jobId: string
  clientLabel: string
  alerts: OperationalJobAlerts
}): Promise<void> => {
  const { jobType, jobId, clientLabel, alerts } = input
  if (!alerts.marginBelowHalf && !alerts.projectedFinishAfterAllocated) return

  const admin = createAdminClient()
  const now = Date.now()

  if (jobType === "move") {
    const { data: row } = await admin
      .from("moves")
      .select(
        "id, status, operational_margin_alert_notified_at, operational_schedule_alert_notified_at",
      )
      .eq("id", jobId)
      .maybeSingle()

    if (!row || isTerminalMoveStatus(row.status as string)) return

    const marginSent = row.operational_margin_alert_notified_at as string | null
    const scheduleSent = row.operational_schedule_alert_notified_at as string | null

    if (alerts.marginBelowHalf && shouldSend(now, marginSent)) {
      const proj = alerts.projectedMarginDollars
      const orig = alerts.originalMarginDollars
      const detail =
        proj != null && orig != null
          ? `Projected margin about $${proj.toLocaleString()} vs planned about $${orig.toLocaleString()}.`
          : "Projected margin has fallen below half of the planned margin for this job."
      await notifyAdmins("in_job_margin_alert", {
        subject: `In-job margin alert: ${clientLabel}`,
        body: `${clientLabel}. ${detail}`,
        description: `${clientLabel}. ${detail}`,
        moveId: jobId,
        sourceId: jobId,
        clientName: clientLabel,
      })
      await admin
        .from("moves")
        .update({ operational_margin_alert_notified_at: new Date().toISOString() })
        .eq("id", jobId)
    }

    if (alerts.projectedFinishAfterAllocated && shouldSend(now, scheduleSent)) {
      const alloc = alerts.allocatedMinutes
      const proj = alerts.projectedTotalMinutes
      const detail =
        alloc != null && proj != null
          ? `About ${formatMinutesAsHhMm(Math.round(proj))} projected vs ${formatMinutesAsHhMm(Math.round(alloc))} allocated.`
          : "Projected finish time exceeds the allocated duration."
      await notifyAdmins("in_job_schedule_alert", {
        subject: `Schedule risk: ${clientLabel}`,
        body: `${clientLabel}. ${detail}`,
        description: `${clientLabel}. ${detail}`,
        moveId: jobId,
        sourceId: jobId,
        clientName: clientLabel,
      })
      await admin
        .from("moves")
        .update({ operational_schedule_alert_notified_at: new Date().toISOString() })
        .eq("id", jobId)
    }
    return
  }

  const { data: drow } = await admin
    .from("deliveries")
    .select(
      "id, status, operational_margin_alert_notified_at, operational_schedule_alert_notified_at",
    )
    .eq("id", jobId)
    .maybeSingle()

  if (!drow || isTerminalDeliveryStatus(drow.status as string)) return

  const marginSentD = drow.operational_margin_alert_notified_at as string | null
  const scheduleSentD = drow.operational_schedule_alert_notified_at as string | null

  if (alerts.marginBelowHalf && shouldSend(now, marginSentD)) {
    const proj = alerts.projectedMarginDollars
    const orig = alerts.originalMarginDollars
    const detail =
      proj != null && orig != null
        ? `Projected margin about $${proj.toLocaleString()} vs planned about $${orig.toLocaleString()}.`
        : "Projected margin has fallen below half of the planned margin for this job."
    await notifyAdmins("in_job_margin_alert", {
      subject: `In-job margin alert: ${clientLabel}`,
      body: `${clientLabel}. ${detail}`,
      description: `${clientLabel}. ${detail}`,
      deliveryId: jobId,
      sourceId: jobId,
      clientName: clientLabel,
    })
    await admin
      .from("deliveries")
      .update({ operational_margin_alert_notified_at: new Date().toISOString() })
      .eq("id", jobId)
  }

  if (alerts.projectedFinishAfterAllocated && shouldSend(now, scheduleSentD)) {
    const alloc = alerts.allocatedMinutes
    const proj = alerts.projectedTotalMinutes
    const detail =
      alloc != null && proj != null
        ? `About ${formatMinutesAsHhMm(Math.round(proj))} projected vs ${formatMinutesAsHhMm(Math.round(alloc))} allocated.`
        : "Projected finish time exceeds the allocated duration."
    await notifyAdmins("in_job_schedule_alert", {
      subject: `Schedule risk: ${clientLabel}`,
      body: `${clientLabel}. ${detail}`,
      description: `${clientLabel}. ${detail}`,
      deliveryId: jobId,
      sourceId: jobId,
      clientName: clientLabel,
    })
    await admin
      .from("deliveries")
      .update({ operational_schedule_alert_notified_at: new Date().toISOString() })
      .eq("id", jobId)
  }
}
