import {
  DELIVERY_STATUS_FLOW,
  MOVE_STATUS_FLOW,
  type TrackingStatus,
} from "@/lib/crew-tracking-status";

/** Event moves: inventory and wrapping stages before transit to venue. */
const EVENT_MOVE_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "inventory_check",
  "loading",
  "wrapping",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

/**
 * Crew checkpoint order for a move, keyed by `moves.service_type` / quote service type.
 * Deliveries use {@link DELIVERY_STATUS_FLOW} only.
 */
export const getCrewStatusFlowForMove = (
  serviceType: string | null | undefined,
): TrackingStatus[] => {
  const s = (serviceType || "").toLowerCase().trim();
  if (s === "labour_only") {
    return ["arrived_at_pickup", "loading", "completed"];
  }
  if (s === "bin_rental") {
    return [
      "en_route_to_pickup",
      "arrived_at_pickup",
      "loading",
      "completed",
    ];
  }
  if (s === "event") {
    return [...EVENT_MOVE_FLOW];
  }
  return [...MOVE_STATUS_FLOW];
};

/** True when this job type and session status require final walkthrough photos before client sign-off. */
export const crewStatusRequiresFinalWalkPhotos = (
  jobType: "move" | "delivery",
  currentStatus: string,
  moveFlow: TrackingStatus[],
): boolean => {
  if (jobType === "delivery") {
    return currentStatus === "arrived_at_destination";
  }
  if (currentStatus === "unloading") return true;
  const idx = moveFlow.indexOf(currentStatus as TrackingStatus);
  if (idx < 0) return false;
  return moveFlow[idx + 1] === "completed" && currentStatus === "loading";
};

/** Allowed tracking statuses for checkpoint API (move + delivery unions). */
export const ALL_KNOWN_TRACKING_STATUSES: readonly string[] = [
  "not_started",
  ...new Set([
    ...MOVE_STATUS_FLOW,
    ...DELIVERY_STATUS_FLOW,
    ...EVENT_MOVE_FLOW,
    "en_route",
    "arrived",
    "delivering",
  ]),
];

export const isAllowedTrackingCheckpointStatus = (status: string): boolean =>
  ALL_KNOWN_TRACKING_STATUSES.includes(status);
