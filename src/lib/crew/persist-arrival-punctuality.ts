import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateArrivalVsCommitmentWindow,
  firstCheckpointTimestamp,
  parseDeliveryScheduleWindow,
  parseMoveScheduleWindow,
} from "@/lib/crew/arrival-punctuality";

/**
 * On `arrived_at_pickup`, score vs move scheduled_date + window (idempotent: keeps first non-null boolean).
 */
export async function persistMoveArrivalOnTimeIfNeeded(
  admin: SupabaseClient,
  moveId: string,
  arrivalIso: string
): Promise<void> {
  const { data: m } = await admin
    .from("moves")
    .select("scheduled_date, arrival_window, scheduled_time, arrived_on_time")
    .eq("id", moveId)
    .maybeSingle();
  if (!m) return;
  if (m.arrived_on_time === true || m.arrived_on_time === false) return;

  const win = parseMoveScheduleWindow({
    scheduled_date: m.scheduled_date as string | null,
    arrival_window: m.arrival_window as string | null,
    scheduled_time: m.scheduled_time as string | null,
  });
  if (!win) return;

  const onTime = evaluateArrivalVsCommitmentWindow({
    scheduledYmd: win.scheduledYmd,
    startMin: win.startMin,
    endMin: win.endMin,
    arrivalIso,
  });
  if (onTime !== true && onTime !== false) return;

  await admin
    .from("moves")
    .update({ arrived_on_time: onTime, updated_at: new Date().toISOString() })
    .eq("id", moveId)
    .is("arrived_on_time", null);
}

/**
 * On `arrived_at_destination`, set deliveries.score_arrived_late (true = late). Overwrites only when currently null.
 */
export async function persistDeliveryArrivedLateIfNeeded(
  admin: SupabaseClient,
  deliveryId: string,
  arrivalIso: string
): Promise<void> {
  const { data: d } = await admin
    .from("deliveries")
    .select(
      "scheduled_date, scheduled_start, scheduled_end, time_slot, delivery_window, estimated_duration_hours, day_type, score_arrived_late",
    )
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return;

  const win = parseDeliveryScheduleWindow({
    scheduled_date: d.scheduled_date as string | null,
    scheduled_start: d.scheduled_start as string | null,
    scheduled_end: d.scheduled_end as string | null,
    time_slot: d.time_slot as string | null,
    delivery_window: d.delivery_window as string | null,
    estimated_duration_hours: d.estimated_duration_hours as number | null,
    day_type: d.day_type as string | null,
  });
  if (!win) return;

  const onTime = evaluateArrivalVsCommitmentWindow({
    scheduledYmd: win.scheduledYmd,
    startMin: win.startMin,
    endMin: win.endMin,
    arrivalIso,
  });
  if (onTime !== true && onTime !== false) return;

  const scoreLate = !onTime;
  await admin
    .from("deliveries")
    .update({ score_arrived_late: scoreLate, updated_at: new Date().toISOString() })
    .eq("id", deliveryId);
}

/** At job completion: fill move punctuality from session if still unscored. */
export async function backfillMoveArrivalOnTimeFromSession(
  admin: SupabaseClient,
  moveId: string
): Promise<boolean | null> {
  const { data: m } = await admin
    .from("moves")
    .select("scheduled_date, arrival_window, scheduled_time, arrived_on_time")
    .eq("id", moveId)
    .maybeSingle();
  if (!m) return null;
  if (m.arrived_on_time === true || m.arrived_on_time === false) {
    return m.arrived_on_time as boolean;
  }

  const { data: sess } = await admin
    .from("tracking_sessions")
    .select("checkpoints")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ts = firstCheckpointTimestamp(sess?.checkpoints, "arrived_at_pickup");
  if (!ts) return null;

  const win = parseMoveScheduleWindow({
    scheduled_date: m.scheduled_date as string | null,
    arrival_window: m.arrival_window as string | null,
    scheduled_time: m.scheduled_time as string | null,
  });
  if (!win) return null;

  const onTime = evaluateArrivalVsCommitmentWindow({
    scheduledYmd: win.scheduledYmd,
    startMin: win.startMin,
    endMin: win.endMin,
    arrivalIso: ts,
  });
  if (onTime !== true && onTime !== false) return null;

  await admin
    .from("moves")
    .update({ arrived_on_time: onTime, updated_at: new Date().toISOString() })
    .eq("id", moveId)
    .is("arrived_on_time", null);

  return onTime;
}

export async function backfillDeliveryScoreArrivedLateFromSession(
  admin: SupabaseClient,
  deliveryId: string
): Promise<boolean | null> {
  const { data: d } = await admin
    .from("deliveries")
    .select(
      "scheduled_date, scheduled_start, scheduled_end, time_slot, delivery_window, estimated_duration_hours, day_type, score_arrived_late",
    )
    .eq("id", deliveryId)
    .maybeSingle();
  if (!d) return null;
  if (d.score_arrived_late === true) return false;
  if (d.score_arrived_late === false) return true;

  const { data: sess } = await admin
    .from("tracking_sessions")
    .select("checkpoints")
    .eq("job_id", deliveryId)
    .eq("job_type", "delivery")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ts = firstCheckpointTimestamp(sess?.checkpoints, "arrived_at_destination");
  if (!ts) return null;

  const win = parseDeliveryScheduleWindow({
    scheduled_date: d.scheduled_date as string | null,
    scheduled_start: d.scheduled_start as string | null,
    scheduled_end: d.scheduled_end as string | null,
    time_slot: d.time_slot as string | null,
    delivery_window: d.delivery_window as string | null,
    estimated_duration_hours: d.estimated_duration_hours as number | null,
    day_type: d.day_type as string | null,
  });
  if (!win) return null;

  const onTime = evaluateArrivalVsCommitmentWindow({
    scheduledYmd: win.scheduledYmd,
    startMin: win.startMin,
    endMin: win.endMin,
    arrivalIso: ts,
  });
  if (onTime !== true && onTime !== false) return null;

  const scoreLate = !onTime;
  await admin
    .from("deliveries")
    .update({ score_arrived_late: scoreLate, updated_at: new Date().toISOString() })
    .eq("id", deliveryId);

  return onTime;
}
