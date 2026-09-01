import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Append a client-facing event to a move's activity feed
 * (`move_timeline_events`), which powers the Updates section on the client
 * tracking dashboard. Best-effort: never throws, so it can be dropped into any
 * booking / crew / change flow without risking the primary action.
 *
 * Icons are Phosphor names (the client feed maps them to inline SVG). Keep
 * `event_type` a stable slug; `label` is the human line the client reads.
 */
export async function logMoveTimelineEvent(
  admin: AdminClient,
  moveId: string,
  e: {
    event_type: string;
    label: string;
    icon?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  },
): Promise<void> {
  if (!moveId) return;
  try {
    await admin.from("move_timeline_events").insert({
      move_id: moveId,
      event_type: e.event_type,
      label: e.label,
      icon: e.icon ?? "Bell",
      ...(e.occurredAt ? { occurred_at: e.occurredAt } : {}),
      metadata: e.metadata ?? {},
    });
  } catch (err) {
    console.error("[timeline-events] failed to log", e.event_type, err);
  }
}
