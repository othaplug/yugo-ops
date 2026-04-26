import {
  DELIVERY_STATUS_FLOW,
  MOVE_STATUS_FLOW,
  type TrackingStatus,
} from "@/lib/crew-tracking-status";
import { normalizeCrewServiceCategory } from "./crew-service-category";

export { normalizeCrewServiceCategory } from "./crew-service-category";

/** B2B delivery: loading at origin, unload at drop-off. */
export const DELIVERY_B2B_STATUS_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

const RESIDENTIAL_MOVE_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "inventory_check",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "walkthrough_photos",
  "completed",
];

const B2B_MOVE_LIKE_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

const SINGLE_ITEM_FLOW: TrackingStatus[] = [...B2B_MOVE_LIKE_FLOW];

const LABOUR_ONLY_FLOW: TrackingStatus[] = [
  "en_route",
  "arrived",
  "working",
  "walkthrough_photos",
  "completed",
];

export const EVENT_MOVE_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_venue",
  "arrived_venue",
  "unloading_setup",
  "event_active",
  "teardown",
  "loading_return",
  "en_route_return",
  "unloading_return",
  "completed",
];

const WHITE_GLOVE_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "wrapping",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "unwrapping_placement",
  "walkthrough_photos",
  "completed",
];

const BIN_RENTAL_FLOW: TrackingStatus[] = [
  "en_route",
  "arrived",
  "delivering_bins",
  "completed",
];

const BIN_RENTAL_PICKUP_FLOW: TrackingStatus[] = [
  "en_route",
  "arrived",
  "collecting_bins",
  "completed",
];

/**
 * Crew checkpoint order for a move, keyed by `moves.service_type` and `moves.move_type`.
 * Deliveries use {@link getCrewStatusFlowForDelivery} only.
 */
export const getCrewStatusFlowForMove = (
  serviceType: string | null | undefined,
  moveType?: string | null,
): TrackingStatus[] => {
  const key = normalizeCrewServiceCategory(serviceType, moveType);
  switch (key) {
    case "labour_only":
      return [...LABOUR_ONLY_FLOW];
    case "bin_rental_pickup":
      return [...BIN_RENTAL_PICKUP_FLOW];
    case "bin_rental":
      return [...BIN_RENTAL_FLOW];
    case "b2b_delivery":
      return [...B2B_MOVE_LIKE_FLOW];
    case "single_item":
      return [...SINGLE_ITEM_FLOW];
    case "event":
      return [...EVENT_MOVE_FLOW];
    case "white_glove":
      return [...WHITE_GLOVE_FLOW];
    case "residential":
      return [...RESIDENTIAL_MOVE_FLOW];
    default:
      return [...RESIDENTIAL_MOVE_FLOW];
  }
};

/**
 * Delivery session flow. Uses extended B2B steps when the quote service type
 * or booking type indicates B2B.
 */
export const getCrewStatusFlowForDelivery = (
  serviceType: string | null | undefined,
  bookingType?: string | null,
): TrackingStatus[] => {
  const st = (serviceType || "").toLowerCase().trim();
  const bt = (bookingType || "").toLowerCase().trim();
  if (
    st === "b2b_delivery" ||
    st === "b2b_oneoff" ||
    bt === "b2b_oneoff" ||
    bt === "b2b_delivery" ||
    bt === "b2b"
  ) {
    return [...DELIVERY_B2B_STATUS_FLOW];
  }
  return [...DELIVERY_STATUS_FLOW];
};

const STATUS_UNION: readonly string[] = [
  "not_started",
  ...new Set(
    [
      ...MOVE_STATUS_FLOW,
      ...DELIVERY_STATUS_FLOW,
      ...DELIVERY_B2B_STATUS_FLOW,
      ...RESIDENTIAL_MOVE_FLOW,
      ...B2B_MOVE_LIKE_FLOW,
      ...SINGLE_ITEM_FLOW,
      ...LABOUR_ONLY_FLOW,
      ...EVENT_MOVE_FLOW,
      ...WHITE_GLOVE_FLOW,
      ...BIN_RENTAL_FLOW,
      ...BIN_RENTAL_PICKUP_FLOW,
    ].flat(),
  ),
];

/** Allowed tracking statuses for checkpoint API (move + delivery unions). */
export const ALL_KNOWN_TRACKING_STATUSES: readonly string[] = STATUS_UNION;

export const isAllowedTrackingCheckpointStatus = (status: string): boolean =>
  ALL_KNOWN_TRACKING_STATUSES.includes(status);
