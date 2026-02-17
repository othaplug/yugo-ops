/** Move lifecycle status (admin + client timeline) */
export const MOVE_STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "final_payment_received", label: "Final Payment Received" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type MoveStatus = (typeof MOVE_STATUS_OPTIONS)[number]["value"];

/** Live tracking progress (day-of-move) */
export const LIVE_TRACKING_STAGES = [
  { key: "on_route", label: "En Route" },
  { key: "arrived_on_site", label: "Arrived On-Site" },
  { key: "loading", label: "Loading" },
  { key: "in_transit", label: "In Transit" },
  { key: "unloading", label: "Unloading" },
  { key: "job_complete", label: "Job Complete" },
] as const;

export type LiveTrackingStage = (typeof LIVE_TRACKING_STAGES)[number]["key"];

export const LIVE_STAGE_MAP: Record<string, number> = {
  on_route: 0,
  arrived_on_site: 1,
  loading: 2,
  in_transit: 3,
  unloading: 4,
  job_complete: 5,
};

/** Status index for progress calculation (0-5) */
export const MOVE_STATUS_INDEX: Record<string, number> = {
  confirmed: 0,
  scheduled: 1,
  final_payment_received: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -1,
};

/** Color classes for status badges (client light theme) */
export const MOVE_STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  scheduled: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
  final_payment_received: "bg-[#8B5CF6]/15 text-[#8B5CF6] border-[#8B5CF6]/30",
  in_progress: "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
  completed: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  cancelled: "bg-[#D14343]/15 text-[#D14343] border-[#D14343]/30",
  // Legacy
  delivered: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  pending: "bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30",
  "in-transit": "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30",
};

/** Admin dark theme status colors */
export const MOVE_STATUS_COLORS_ADMIN: Record<string, string> = {
  confirmed: "text-[var(--grn)] bg-[rgba(45,159,90,0.12)]",
  scheduled: "text-[#3B82F6] bg-[rgba(59,130,246,0.12)]",
  final_payment_received: "text-[#8B5CF6] bg-[rgba(139,92,246,0.12)]",
  in_progress: "text-[var(--org)] bg-[rgba(212,138,41,0.12)]",
  completed: "text-[var(--grn)] bg-[rgba(45,159,90,0.12)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.12)]",
  // Legacy
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.12)]",
  pending: "text-[var(--org)] bg-[rgba(212,138,41,0.12)]",
  "in-transit": "text-[var(--gold)] bg-[var(--gdim)]",
};

/** Map legacy status to display label */
export function getStatusLabel(status: string | null): string {
  if (!status) return "—";
  const found = MOVE_STATUS_OPTIONS.find((o) => o.value === status);
  if (found) return found.label;
  const legacy: Record<string, string> = {
    delivered: "Completed",
    pending: "Confirmed",
    "in-transit": "In Progress",
    dispatched: "In Progress",
    quote: "Confirmed",
  };
  return legacy[status] || status.replace(/-/g, " ");
}

/** Normalize legacy status to new status value for DB updates */
export function normalizeStatus(status: string | null): string | null {
  if (!status) return null;
  const legacy: Record<string, string> = {
    delivered: "completed",
    pending: "confirmed",
    "in-transit": "in_progress",
    dispatched: "in_progress",
    quote: "confirmed",
  };
  return legacy[status] || status;
}
