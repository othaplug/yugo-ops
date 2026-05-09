import "server-only";
import { isGCalConfigured } from "./client";
import { syncJobToGCal } from "./sync-job";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchBaselineHoursBySize,
  fetchDeliveryDurationByType,
  fetchSingleJobBlock,
  resolveDeliveryJobTimes,
  resolveMoveJobTimes,
} from "./resolve-job-times";

/** Fire-and-forget GCal sync for a move row. Reads fresh from DB, updates gcal_event_id. */
export function triggerMoveGCalSync(moveId: string): void {
  if (!isGCalConfigured()) return;
  void (async () => {
    try {
      const db = createAdminClient();
      // Pull every field used by resolveMoveDisplayTimes() in the OPS+ internal calendar.
      const { data: m } = await db
        .from("moves")
        .select("id, move_code, move_size, est_hours, client_name, service_type, move_type, status, scheduled_date, scheduled_start, scheduled_end, scheduled_time, preferred_time, arrival_window, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
        .eq("id", moveId)
        .single();
      if (!m) return;

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

      const result = await syncJobToGCal({
        jobType: "move",
        jobId: moveId,
        jobCode: String(m.move_code || moveId),
        clientName: String(m.client_name || ""),
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
      });

      if (result.eventId !== undefined) {
        await db.from("moves").update({ gcal_event_id: result.eventId }).eq("id", moveId);
      }
    } catch {
      // non-critical
    }
  })();
}

/** Fire-and-forget GCal sync for a delivery row. Reads fresh from DB, updates gcal_event_id. */
export function triggerDeliveryGCalSync(deliveryId: string): void {
  if (!isGCalConfigured()) return;
  void (async () => {
    try {
      const db = createAdminClient();
      // Pull every field used by resolveDeliveryDisplayTimes().
      const { data: d } = await db
        .from("deliveries")
        .select("id, delivery_number, client_name, customer_name, service_type, delivery_type, category, status, scheduled_date, time_slot, scheduled_start, scheduled_end, estimated_duration_minutes, estimated_duration_hours, from_address, pickup_address, to_address, delivery_address, crew_id, notes, gcal_event_id")
        .eq("id", deliveryId)
        .single();
      if (!d) return;

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
        serviceType: String(d.service_type || "b2b_delivery"),
        status: String(d.status || "confirmed"),
        scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : null,
        startTime: startHHMM,
        estimatedDurationMinutes:
          durationMinutes ??
          (d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null),
        fromAddress: String(d.from_address || d.pickup_address || "").trim() || null,
        toAddress: String(d.to_address || d.delivery_address || "").trim() || null,
        crewName,
        notes: d.notes ? String(d.notes) : null,
        existingEventId: (d as { gcal_event_id?: string | null }).gcal_event_id ?? null,
      });

      if (result.eventId !== undefined) {
        await db.from("deliveries").update({ gcal_event_id: result.eventId }).eq("id", deliveryId);
      }
    } catch {
      // non-critical
    }
  })();
}
