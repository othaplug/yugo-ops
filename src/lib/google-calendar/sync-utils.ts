import "server-only";
import { isGCalConfigured } from "./client";
import { syncJobToGCal } from "./sync-job";
import { createAdminClient } from "@/lib/supabase/admin";

/** Fire-and-forget GCal sync for a move row. Reads fresh from DB, updates gcal_event_id. */
export function triggerMoveGCalSync(moveId: string): void {
  if (!isGCalConfigured()) return;
  void (async () => {
    try {
      const db = createAdminClient();
      const { data: m } = await db
        .from("moves")
        .select("id, move_code, client_name, service_type, move_type, status, scheduled_date, scheduled_start, estimated_duration_minutes, from_address, to_address, crew_id, notes, gcal_event_id")
        .eq("id", moveId)
        .single();
      if (!m) return;

      // Resolve crew name
      let crewName: string | null = null;
      if (m.crew_id) {
        const { data: crew } = await db.from("crews").select("name").eq("id", m.crew_id).single();
        crewName = crew?.name ?? null;
      }

      const result = await syncJobToGCal({
        jobType: "move",
        jobId: moveId,
        jobCode: String(m.move_code || moveId),
        clientName: String(m.client_name || ""),
        serviceType: String(m.service_type || m.move_type || "residential"),
        status: String(m.status || "confirmed"),
        scheduledDate: m.scheduled_date ? String(m.scheduled_date).slice(0, 10) : null,
        startTime: m.scheduled_start ? String(m.scheduled_start).slice(0, 5) : null,
        estimatedDurationMinutes: m.estimated_duration_minutes != null ? Number(m.estimated_duration_minutes) : null,
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
      const { data: d } = await db
        .from("deliveries")
        .select("id, delivery_number, client_name, customer_name, service_type, status, scheduled_date, time_slot, estimated_duration_minutes, from_address, pickup_address, to_address, delivery_address, crew_id, notes, gcal_event_id")
        .eq("id", deliveryId)
        .single();
      if (!d) return;

      let crewName: string | null = null;
      if (d.crew_id) {
        const { data: crew } = await db.from("crews").select("name").eq("id", d.crew_id).single();
        crewName = crew?.name ?? null;
      }

      const result = await syncJobToGCal({
        jobType: "delivery",
        jobId: deliveryId,
        jobCode: String(d.delivery_number || deliveryId),
        clientName: String(d.client_name || d.customer_name || ""),
        serviceType: String(d.service_type || "b2b_delivery"),
        status: String(d.status || "confirmed"),
        scheduledDate: d.scheduled_date ? String(d.scheduled_date).slice(0, 10) : null,
        startTime: d.time_slot ? String(d.time_slot).slice(0, 5) : null,
        estimatedDurationMinutes: d.estimated_duration_minutes != null ? Number(d.estimated_duration_minutes) : null,
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
