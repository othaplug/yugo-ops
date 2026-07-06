import "server-only";
import { isGCalConfigured } from "./client";
import { syncJobToGCal, type GCalSyncResult } from "./sync-job";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchBaselineHoursBySize,
  fetchDeliveryDurationByType,
  fetchSingleJobBlock,
  resolveDeliveryJobTimes,
  resolveMoveJobTimes,
} from "./resolve-job-times";

/**
 * Awaitable GCal sync for a move row. Reads fresh from DB, updates
 * gcal_event_id, returns the action ("created" | "updated" | ...). Used
 * by the resync cron / admin backfill so the result is observable.
 */
export async function syncMoveGCalNow(
  moveId: string,
): Promise<"created" | "updated" | "deleted" | "skipped" | "error" | "not_configured" | "not_found"> {
  if (!isGCalConfigured()) return "not_configured";
  return await runMoveGCalSync(moveId);
}

/** Fire-and-forget GCal sync for a move row. Reads fresh from DB, updates gcal_event_id. */
export function triggerMoveGCalSync(moveId: string): void {
  if (!isGCalConfigured()) return;
  void runMoveGCalSync(moveId).catch(() => {});
}

async function runMoveGCalSync(
  moveId: string,
): Promise<"created" | "updated" | "deleted" | "skipped" | "error" | "not_found"> {
  try {
    const db = createAdminClient();
      // Pull every field used by resolveMoveDisplayTimes() in the OPS+ internal calendar.
      // PM fields (is_pm_move, pm_*, partner_property_id, contract_id) let the
      // GCal event render as "PM Reno Move-In / Move-Out / Suite Transfer"
      // with building + unit + reason instead of falling through to a bare
      // "B2B Delivery" (which is what MV-30323 / MV-30324 shipped as before
      // 2026-07-06). Tier / total_price / client contact make the event body
      // actionable for the crew reading the invite.
      const { data: m } = await db
        .from("moves")
        .select(
          "id, move_code, move_size, est_hours, est_crew_size, client_name, client_phone, client_email, service_type, move_type, status, scheduled_date, scheduled_start, scheduled_end, scheduled_time, preferred_time, arrival_window, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id, is_pm_move, pm_move_kind, pm_reason_code, pm_building_code, pm_zone, pm_urgency, pm_packing_required, partner_property_id, contract_id, tier_selected, total_price",
        )
        .eq("id", moveId)
        .single();
    if (!m) return "not_found";

      // Resolve crew name
      let crewName: string | null = null;
      if (m.crew_id) {
        const { data: crew } = await db.from("crews").select("name").eq("id", m.crew_id).single();
        crewName = crew?.name ?? null;
      }

      // Same time resolution as the OPS+ internal calendar (with crew block fallback).
      const [block, baselineMap] = await Promise.all([
        fetchSingleJobBlock("move", moveId),
        fetchBaselineHoursBySize(),
      ]);
      const { startHHMM, durationMinutes } = resolveMoveJobTimes(
        m as Record<string, unknown>,
        block,
        baselineMap,
      );

      const mm = m as Record<string, unknown>;
      const result = await syncJobToGCal({
        jobType: "move",
        jobId: moveId,
        jobCode: String(m.move_code || moveId),
        clientName: String(m.client_name || ""),
        clientPhone: mm.client_phone ? String(mm.client_phone) : null,
        clientEmail: mm.client_email ? String(mm.client_email) : null,
        serviceType: String(m.service_type || m.move_type || "residential"),
        status: String(m.status || "confirmed"),
        scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : null,
        startTime: startHHMM,
        estimatedDurationMinutes:
          durationMinutes ??
          (m.estimated_duration_minutes != null ? Number(m.estimated_duration_minutes) : null),
        fromAddress: m.from_address ? String(m.from_address) : null,
        toAddress: m.to_address ? String(m.to_address) : null,
        crewName,
        notes: m.notes ? String(m.notes) : null,
        existingEventId: (m as { gcal_event_id?: string | null }).gcal_event_id ?? null,
        // PM context — used by sync-job to override the label + enrich body.
        isPmMove: !!mm.is_pm_move || !!mm.contract_id,
        pmReasonCode: mm.pm_reason_code ? String(mm.pm_reason_code) : null,
        pmMoveKind: mm.pm_move_kind ? String(mm.pm_move_kind) : null,
        pmBuildingCode: mm.pm_building_code ? String(mm.pm_building_code) : null,
        pmZone: mm.pm_zone ? String(mm.pm_zone) : null,
        pmUrgency: mm.pm_urgency ? String(mm.pm_urgency) : null,
        pmPackingRequired:
          typeof mm.pm_packing_required === "boolean" ? mm.pm_packing_required : null,
        tierSelected: mm.tier_selected ? String(mm.tier_selected) : null,
        totalPrice:
          typeof mm.total_price === "number" && mm.total_price > 0
            ? mm.total_price
            : null,
        crewSize:
          typeof mm.est_crew_size === "number" && mm.est_crew_size > 0
            ? mm.est_crew_size
            : null,
      });

    if (result.eventId !== undefined) {
      await db.from("moves").update({ gcal_event_id: result.eventId }).eq("id", moveId);
    }
    return result.action;
  } catch {
    return "error";
  }
}

/** Awaitable GCal sync for a single delivery. Reads fresh from DB, updates gcal_event_id. */
export async function syncDeliveryGCalNow(deliveryId: string): Promise<GCalSyncResult["action"] | "not_configured" | "not_found"> {
  if (!isGCalConfigured()) return "not_configured";
  const db = createAdminClient();
  // Pull every field used by resolveDeliveryDisplayTimes().
  // NOTE: deliveries has NO service_type / from_address / to_address columns
  // (it uses delivery_type/category, pickup_address, delivery_address).
  // Selecting a non-existent column errors the WHOLE query and returns null,
  // which previously made every delivery sync silently report "not found".
  const { data: d } = await db
    .from("deliveries")
    .select("id, delivery_number, client_name, customer_name, delivery_type, category, status, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_minutes, estimated_duration_hours, pickup_address, delivery_address, crew_id, notes, gcal_event_id")
    .eq("id", deliveryId)
    .single();
  if (!d) return "not_found";

  let crewName: string | null = null;
  if (d.crew_id) {
    const { data: crew } = await db.from("crews").select("name").eq("id", d.crew_id).single();
    crewName = crew?.name ?? null;
  }

  const [block, deliveryDurMap] = await Promise.all([
    fetchSingleJobBlock("delivery", deliveryId),
    fetchDeliveryDurationByType(),
  ]);
  const { startHHMM, durationMinutes } = resolveDeliveryJobTimes(
    d as Record<string, unknown>,
    block,
    deliveryDurMap,
  );

  const result = await syncJobToGCal({
    jobType: "delivery",
    jobId: deliveryId,
    jobCode: String(d.delivery_number || deliveryId),
    clientName: String(d.client_name || d.customer_name || ""),
    serviceType: String(d.delivery_type || d.category || "b2b_delivery"),
    status: String(d.status || "confirmed"),
    scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : null,
    startTime: startHHMM,
    estimatedDurationMinutes:
      durationMinutes ??
      (d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null),
    fromAddress: String(d.pickup_address || "").trim() || null,
    toAddress: String(d.delivery_address || "").trim() || null,
    crewName,
    notes: d.notes ? String(d.notes) : null,
    existingEventId: (d as { gcal_event_id?: string | null }).gcal_event_id ?? null,
  });

  if (result.eventId !== undefined) {
    await db.from("deliveries").update({ gcal_event_id: result.eventId }).eq("id", deliveryId);
  }
  return result.action;
}

/** Fire-and-forget GCal sync for a delivery row. */
export function triggerDeliveryGCalSync(deliveryId: string): void {
  if (!isGCalConfigured()) return;
  void syncDeliveryGCalNow(deliveryId).catch(() => {});
}
