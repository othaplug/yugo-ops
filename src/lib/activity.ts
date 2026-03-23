/**
 * Central helper for writing to the admin activity feed (status_events table).
 * Always fire-and-forget — never block or throw to callers.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type ActivityIcon =
  | "move"
  | "delivery"
  | "quote"
  | "dollar"
  | "mail"
  | "check"
  | "x"
  | "alert"
  | "clock"
  | "pen"
  | "invoice"
  | "payment"
  | "follow_up"
  | "partner"
  | "crew";

export interface ActivityEvent {
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string;
  icon?: ActivityIcon;
}

/**
 * Insert an activity event into the status_events table.
 * Always safe — silently no-ops on error.
 */
export async function logActivity(event: ActivityEvent): Promise<void> {
  try {
    const db = createAdminClient();
    await db.from("status_events").insert({
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      event_type: event.event_type,
      description: event.description,
      icon: event.icon ?? null,
    });
  } catch {
    // Non-fatal — activity feed is best-effort
  }
}
