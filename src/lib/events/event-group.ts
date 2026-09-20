/**
 * Event bookings are TWO `moves` rows sharing an `event_group_id`: a "delivery"
 * leg and a "return"/teardown leg. Revenue lives on the delivery leg; the return
 * leg is $0. Almost every count, notification, and completion side effect was
 * written for a single move, so without these helpers an event either
 * double-fires (two review requests, two "move complete" texts, counted as two
 * jobs) or fires on the wrong leg (a "your move is complete" email on delivery
 * day while the teardown is still four days out).
 *
 * Two rules:
 *   - COUNTS / aggregates: skip the return leg so the event counts once.
 *   - CLIENT completion side effects: fire ONCE, on the LAST leg to complete
 *     (the return), never on the delivery leg while a return is still pending.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** True when a row is the event's $0 return/teardown leg. */
export function isEventReturnLeg(row: {
  event_phase?: string | null;
  event_group_id?: string | null;
}): boolean {
  return String(row?.event_phase ?? "") === "return" && !!row?.event_group_id;
}

/** True when a row belongs to an event booking. */
export function isEventMove(row: {
  move_type?: string | null;
  service_type?: string | null;
  event_group_id?: string | null;
}): boolean {
  return (
    String(row?.move_type ?? row?.service_type ?? "") === "event" ||
    !!row?.event_group_id
  );
}

export type EventCompletionGate = {
  isEvent: boolean;
  isReturnLeg: boolean;
  /** Fire client-facing completion side effects (review, thank-you SMS,
   *  referral, "move complete" email/ETA) for this leg? */
  fireClientNotifications: boolean;
};

/**
 * Decide whether a completing move should run its CLIENT-facing completion side
 * effects. Non-event moves always do. An event fires them once, on the last leg
 * to complete: the return leg fires; the delivery leg fires only when there is
 * no return sibling (a single-leg event).
 */
export async function eventCompletionGate(
  sb: SupabaseClient,
  moveId: string,
): Promise<EventCompletionGate> {
  const { data: m } = await sb
    .from("moves")
    .select("id, move_type, service_type, event_group_id, event_phase")
    .eq("id", moveId)
    .maybeSingle();

  if (!m || !isEventMove(m) || !m.event_group_id) {
    return { isEvent: false, isReturnLeg: false, fireClientNotifications: true };
  }
  if (String(m.event_phase ?? "") === "return") {
    return { isEvent: true, isReturnLeg: true, fireClientNotifications: true };
  }
  // Delivery leg: only the final leg if there is no return sibling.
  const { data: ret } = await sb
    .from("moves")
    .select("id")
    .eq("event_group_id", m.event_group_id)
    .eq("event_phase", "return")
    .limit(1);
  const hasReturn = !!ret && ret.length > 0;
  return {
    isEvent: true,
    isReturnLeg: false,
    fireClientNotifications: !hasReturn,
  };
}

/** All move ids in an event group (for fan-out writes / deletes). */
export async function eventGroupMoveIds(
  sb: SupabaseClient,
  eventGroupId: string,
): Promise<string[]> {
  const { data } = await sb
    .from("moves")
    .select("id")
    .eq("event_group_id", eventGroupId);
  return (data ?? []).map((r) => r.id as string);
}
