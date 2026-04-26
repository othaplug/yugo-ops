/** Crew tracking status progression. Used by crew portal and notifications. */

import type { TrackingStatus } from "./tracking-status-types";

export type { TrackingStatus } from "./tracking-status-types";

/** Move status progression (default when no service-specific flow is supplied). */
export const MOVE_STATUS_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

/**
 * Crew job horizontal bar: five key checkpoints (summary, not 1:1 with every DB status).
 * En route · Loading · To drop-off · Unloading · Complete
 */
export const CREW_MOVE_PROGRESS_BAR_LABELS: string[] = [
  "En route",
  "Loading",
  "To drop-off",
  "Unloading",
  "Complete",
];

/** Map MOVE_STATUS_FLOW index (0–6) to {@link CREW_MOVE_PROGRESS_BAR_LABELS} index (0–4). */
export function mapMoveProgressIdxToBarIndex(progressIdx: number): number {
  if (progressIdx < 0) return -1;
  if (progressIdx <= 1) return 0;
  if (progressIdx === 2) return 1;
  if (progressIdx === 3) return 2;
  if (progressIdx <= 5) return 3;
  return 4;
}

/** Crew job horizontal bar for deliveries: one label per DELIVERY_STATUS_FLOW step. */
export const CREW_DELIVERY_PROGRESS_BAR_LABELS: string[] = [
  "To pickup",
  "At pickup",
  "To drop-off",
  "At drop-off",
  "Complete",
];

/** Delivery/project status progression */
export const DELIVERY_STATUS_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route_to_destination",
  "arrived_at_destination",
  "completed",
];

/** Map legacy short delivery statuses to the full flow equivalents */
const DELIVERY_STATUS_COMPAT: Record<string, TrackingStatus> = {
  en_route: "en_route_to_pickup",
  on_route: "en_route_to_pickup",
  arrived: "arrived_at_pickup",
  delivering: "arrived_at_destination",
};

export function normalizeDeliveryStatus(status: string): string {
  return DELIVERY_STATUS_COMPAT[status] ?? status;
}

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  not_started: "Not Started",
  en_route_to_pickup: "En route to pickup",
  arrived_at_pickup: "Arrived at pickup",
  inventory_check: "Inventory walkthrough",
  loading: "Loading",
  wrapping: "Wrapping",
  en_route_to_destination: "En route to destination",
  en_route_venue: "En route to venue",
  arrived_at_destination: "Arrived at destination",
  arrived_venue: "Arrived at venue",
  unloading: "Unloading",
  unloading_setup: "Setup at venue",
  event_active: "Event active",
  teardown: "Teardown",
  loading_return: "Loading for return",
  en_route_return: "En route (return)",
  unloading_return: "Unloading at origin",
  unwrapping_placement: "Placement and unwrapping",
  walkthrough_photos: "Final photos",
  working: "Working",
  delivering_bins: "Delivering bins",
  collecting_bins: "Collecting bins",
  completed: "Complete",
  en_route: "En route",
  arrived: "Arrived",
  delivering: "Delivering / Installing",
};

export function getNextStatus(
  current: string,
  jobType: "move" | "delivery",
  options?: { moveFlow?: TrackingStatus[]; deliveryFlow?: TrackingStatus[] },
): TrackingStatus | null {
  const flow =
    jobType === "move" && options?.moveFlow?.length
      ? options.moveFlow
      : jobType === "delivery" && options?.deliveryFlow?.length
        ? options.deliveryFlow
        : jobType === "move"
          ? MOVE_STATUS_FLOW
          : DELIVERY_STATUS_FLOW;
  const idx = flow.indexOf(current as TrackingStatus);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

/** Human labels for the next N checkpoints after `current` (for crew UI). */
export function getUpcomingStatusLabels(
  current: string,
  jobType: "move" | "delivery",
  count: number,
  options?: { moveFlow?: TrackingStatus[]; deliveryFlow?: TrackingStatus[] },
): string[] {
  const flow =
    jobType === "move" && options?.moveFlow?.length
      ? options.moveFlow
      : jobType === "delivery" && options?.deliveryFlow?.length
        ? options.deliveryFlow
        : jobType === "move"
          ? MOVE_STATUS_FLOW
          : DELIVERY_STATUS_FLOW;
  const idx = flow.indexOf(current as TrackingStatus);
  if (idx < 0 || count <= 0) return [];
  const out: string[] = [];
  for (let j = idx + 1; j < flow.length && out.length < count; j++) {
    out.push(getStatusLabel(flow[j]));
  }
  return out;
}

export function getFirstStatus(
  jobType: "move" | "delivery",
  customFlow?: TrackingStatus[],
): TrackingStatus {
  if (customFlow?.length) return customFlow[0];
  if (jobType === "move") return MOVE_STATUS_FLOW[0];
  return DELIVERY_STATUS_FLOW[0];
}

export function getStatusLabel(s: string): string {
  return TRACKING_STATUS_LABELS[s as TrackingStatus] || s.replace(/_/g, " ");
}

/** Crew job UI: origin/drop-off wording for deliveries and B2B moves (pickup/destination are internal keys). */
const LOGISTICS_CHECKPOINT_LABELS: Partial<Record<TrackingStatus, string>> = {
  en_route_to_pickup: "En Route to Origin",
  arrived_at_pickup: "Arrived at Origin",
  inventory_check: "Inventory walkthrough",
  wrapping: "Wrapping / prep",
  en_route_to_destination: "En Route to Drop-Off",
  en_route_venue: "En Route to Venue",
  arrived_venue: "Arrived at Venue",
  arrived_at_destination: "Arrived at Drop-Off",
  en_route_return: "En Route (return)",
  unloading_return: "Unloading at Origin",
};

export function getCrewCheckpointDisplayLabel(
  status: string,
  useLogisticsCopy: boolean,
): string {
  if (useLogisticsCopy) {
    const mapped = LOGISTICS_CHECKPOINT_LABELS[status as TrackingStatus];
    if (mapped) return mapped;
  }
  return getStatusLabel(status);
}
