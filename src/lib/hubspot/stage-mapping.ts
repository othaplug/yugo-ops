/**
 * Maps OPS+ record status strings to logical HubSpot pipeline stage names.
 *
 * Used when creating a HubSpot deal for a record whose status may already be
 * past "sent" — e.g. during backfill, retroactive sync, or when a deal is
 * created for an already-accepted or booked quote.
 */

import { YUGO_TRIGGER_TO_LOGICAL_STAGE } from "@/lib/hubspot/logical-deal-stages"

/**
 * Resolve an OPS+ quote/move/delivery status to a logical HubSpot stage name.
 *
 * Examples:
 *   "sent"          → "quote_sent"
 *   "viewed"        → "quote_viewed"
 *   "accepted"      → "booked"
 *   "confirmed"     → "booked"
 *   "completed"     → "closed_won"
 *   "cancelled"     → "closed_lost"
 *   "no_show"       → "closed_lost"
 *
 * Falls back to "quote_sent" for unrecognised values (safe default for new sends).
 */
export function resolveStageFromStatus(status: string | null | undefined): string {
  const s = String(status || "")
    .trim()
    .toLowerCase()

  // Delegate to the shared trigger → logical-stage map first
  const fromTrigger = YUGO_TRIGGER_TO_LOGICAL_STAGE[s]
  if (fromTrigger) return fromTrigger

  // Additional OPS+ status values not covered by the trigger map
  switch (s) {
    case "accepted":
    case "pending":
    case "pending_approval":
    case "booked":
      return "booked"
    case "final_payment_received":
      return "closed_won"
    case "no_show":
      return "closed_lost"
    default:
      return "quote_sent"
  }
}
