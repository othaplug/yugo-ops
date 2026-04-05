/** Move lifecycle status (admin + client timeline). Values are DB/enum; labels only in UI.
 *  Note: "paid" is a DB payment-flag status and is intentionally excluded from selectable options
 *  and progress bar steps — it should not appear as a manual dropdown choice or a named stage. */
export const MOVE_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type MoveStatus = (typeof MOVE_STATUS_OPTIONS)[number]["value"];

/** Live tracking progress (day-of-move). Pending = not in progress yet. */
export const LIVE_TRACKING_STAGES = [
  { key: "pending", label: "Pending" },
  { key: "en_route_to_pickup", label: "En Route to Pickup" },
  { key: "arrived_at_pickup", label: "Arrived at Pickup" },
  { key: "loading", label: "Loading" },
  { key: "en_route_to_destination", label: "En Route to Destination" },
  { key: "arrived_at_destination", label: "Arrived" },
  { key: "unloading", label: "Unloading" },
  { key: "job_complete", label: "Job Complete" },
  // Legacy keys kept for backward compatibility
  { key: "on_route", label: "En Route to Pickup" },
  { key: "arrived_on_site", label: "Arrived at Pickup" },
  { key: "in_transit", label: "En Route to Destination" },
] as const;

export type LiveTrackingStage = (typeof LIVE_TRACKING_STAGES)[number]["key"];

/** Index for progress bar: pending = -1 (0%), then 0–6 for the seven active stages. */
export const LIVE_STAGE_MAP: Record<string, number> = {
  pending: -1,
  // Primary crew tracking statuses
  en_route_to_pickup: 0,
  arrived_at_pickup: 1,
  loading: 2,
  en_route_to_destination: 3,
  arrived_at_destination: 4,
  unloading: 5,
  job_complete: 6,
  completed: 6,
  // Legacy keys
  on_route: 0,
  arrived_on_site: 1,
  in_transit: 3,
};

/** Map crew tracking status to client display label */
export const CREW_STATUS_TO_LABEL: Record<string, string> = {
  booked: "Scheduled",
  en_route_to_pickup: "En Route to Pickup",
  arrived_at_pickup: "Arrived at Pickup",
  loading: "Loading",
  en_route_to_destination: "En Route to Destination",
  arrived_at_destination: "Arrived at Destination",
  unloading: "Unloading",
  completed: "Complete",
  en_route: "En Route to Pick Up",
  arrived: "Arrived at Pickup",
  delivering: "Delivering/Installing",
};

/** Status index for progress calculation (0-5) */
export const MOVE_STATUS_INDEX: Record<string, number> = {
  confirmed: 0,
  /** Pre-booking / CRM pipeline — same step as confirmed in admin UX */
  quoted: 0,
  quote: 0,
  /** Auto-scheduling outcomes — show at the "Confirmed" step until slot is resolved */
  confirmed_pending_schedule: 0,
  confirmed_unassigned: 0,
  scheduled: 1,
  /** "paid" is a DB payment flag, not a selectable stage — display at the "Scheduled" step */
  paid: 1,
  final_payment_received: 1, // legacy alias
  in_progress: 2,
  completed: 3,
  cancelled: -1,
};

/** Color classes for status badges (client light theme) */
export const MOVE_STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  quoted: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  quote: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  scheduled: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
  paid: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  final_payment_received: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30", // legacy
  in_progress: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  completed: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  cancelled: "bg-[#D14343]/15 text-[#D14343] border-[#D14343]/30",
  delivered: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  pending: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  "in-transit": "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  confirmed_pending_schedule:
    "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  confirmed_unassigned: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
};

/** Admin status — text color only (no pill backgrounds; use with .dt-badge uppercase) */
export const MOVE_STATUS_COLORS_ADMIN: Record<string, string> = {
  confirmed: "text-[#A8D4B8]",
  quoted: "text-[#A8D4B8]",
  quote: "text-[#A8D4B8]",
  scheduled: "text-[#E8B4C8]",
  paid: "text-[#A8D4B8]",
  final_payment_received: "text-[#A8D4B8]", // legacy
  in_progress: "text-[#E8B4C8]",
  completed: "text-[#A8D4B8]",
  cancelled: "text-[#E87070]",
  delivered: "text-[#A8D4B8]",
  pending: "text-[#E8B4C8]",
  "in-transit": "text-[#E8B4C8]",
  confirmed_pending_schedule: "text-[#E8B4C8]",
  confirmed_unassigned: "text-[#E87070]",
};

/** Timeline/line color by move status (CSS var or hex for the vertical line next to time) */
export const MOVE_STATUS_LINE_COLOR: Record<string, string> = {
  confirmed: "var(--grn)",
  quoted: "var(--grn)",
  quote: "var(--grn)",
  scheduled: "#3B82F6",
  paid: "var(--grn)",
  final_payment_received: "var(--grn)",
  in_progress: "var(--org)",
  completed: "var(--grn)",
  cancelled: "var(--red)",
  delivered: "var(--grn)",
  pending: "var(--gold)",
  "in-transit": "var(--gold)",
  confirmed_pending_schedule: "var(--gold)",
  confirmed_unassigned: "var(--red)",
};

/** Timeline/line color by delivery status */
export const DELIVERY_STATUS_LINE_COLOR: Record<string, string> = {
  pending: "var(--gold)",
  scheduled: "#3B82F6",
  confirmed: "#3B82F6",
  dispatched: "var(--org)",
  "in-transit": "var(--org)",
  delivered: "var(--grn)",
  cancelled: "var(--red)",
};

/** Map status to display label. Never show underscores or raw enum in UI. */
export function getStatusLabel(status: string | null): string {
  if (!status) return "-";
  const found = MOVE_STATUS_OPTIONS.find((o) => o.value === status);
  if (found) return found.label;
  const legacy: Record<string, string> = {
    // "paid" is a DB payment flag, not a selectable stage — surface it as "Scheduled"
    paid: "Scheduled",
    final_payment_received: "Scheduled",
    delivered: "Completed",
    pending: "Confirmed",
    "in-transit": "In Progress",
    dispatched: "In Progress",
    quote: "Confirmed",
    /** DB/CRM value — not a selectable admin status; same bucket as confirmed */
    quoted: "Confirmed",
    // Auto-scheduling outcomes
    confirmed_pending_schedule: "Pending Time Slot",
    confirmed_unassigned: "Needs Scheduling",
  };
  if (legacy[status]) return legacy[status];
  return status
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Normalize legacy status to new status value for DB updates */
export function normalizeStatus(status: string | null): string | null {
  if (!status) return null;
  const legacy: Record<string, string> = {
    // "paid" and legacy aliases resolve to "scheduled" (the canonical selectable stage)
    paid: "scheduled",
    final_payment_received: "scheduled",
    delivered: "completed",
    pending: "confirmed",
    "in-transit": "in_progress",
    dispatched: "in_progress",
    quote: "confirmed",
    quoted: "confirmed",
    // Auto-scheduling statuses pass through as-is — don't normalize them away
    confirmed_pending_schedule: "confirmed_pending_schedule",
    confirmed_unassigned: "confirmed_unassigned",
  };
  return legacy[status] || status;
}
