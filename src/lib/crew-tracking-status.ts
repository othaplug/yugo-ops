/** Crew tracking status progression. Used by crew portal and notifications. */

export type TrackingStatus =
  | "not_started"
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "loading"
  | "en_route_to_destination"
  | "arrived_at_destination"
  | "unloading"
  | "completed"
  // Delivery-specific (shorter flow)
  | "en_route"
  | "arrived"
  | "delivering";

/** Move status progression */
export const MOVE_STATUS_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

/** Delivery/project status progression (shorter) */
export const DELIVERY_STATUS_FLOW: TrackingStatus[] = [
  "en_route",
  "arrived",
  "delivering",
  "completed",
];

export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  not_started: "Not Started",
  en_route_to_pickup: "En Route to Pickup",
  arrived_at_pickup: "Arrived at Pickup",
  loading: "Loading",
  en_route_to_destination: "En Route to Destination",
  arrived_at_destination: "Arrived at Destination",
  unloading: "Unloading",
  completed: "Completed",
  en_route: "En Route",
  arrived: "Arrived",
  delivering: "Delivering / Installing",
};

export function getNextStatus(
  current: string,
  jobType: "move" | "delivery"
): TrackingStatus | null {
  const flow = jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  const idx = flow.indexOf(current as TrackingStatus);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

export function getFirstStatus(jobType: "move" | "delivery"): TrackingStatus {
  const flow = jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  return flow[0];
}

export function getStatusLabel(s: string): string {
  return TRACKING_STATUS_LABELS[s as TrackingStatus] || s.replace(/_/g, " ");
}
