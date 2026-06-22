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

// White-glove is a vendor pickup + placement delivery, not a residential move.
// No "wrapping" or "unwrapping_placement" stages — items arrive packaged from
// the vendor, the crew inspects each piece before loading, places to spec at
// the destination, and removes packaging on the way out.
//
// Stages map to existing TrackingStatus keys (DB-stable). Display copy is
// overridden per service type via WHITE_GLOVE_STAGE_LABELS below so the crew
// app shows "Item inspection" / "Placement to spec" / "Packaging removal"
// instead of the residential defaults.
// White-glove DELIVERY (vendor → client). 6-step hands-free flow: two work
// blocks ("At vendor" covers inspection+loading; "At destination" covers
// placement+packaging-removal) bookended by transit transitions. Photo
// categories under each work step still capture per-stage evidence.
const WHITE_GLOVE_DELIVERY_FLOW: TrackingStatus[] = [
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route_to_destination",
  "arrived_at_destination",
  "walkthrough_photos",
  "completed",
];

// White-glove IN-HOME service (assembly, install, rearrangement). Same address
// — no vendor, no transit. Trimmed to 4 steps so the crew can keep working
// without putting the phone down for every micro-stage. Protect / inspect /
// place / packaging-removal are all covered under the single "Service" step;
// photo categories under that step still capture the evidence per stage.
const WHITE_GLOVE_INHOME_FLOW: TrackingStatus[] = [
  "arrived",
  "working",
  "walkthrough_photos",
  "completed",
];

// Back-compat alias.
const WHITE_GLOVE_FLOW = WHITE_GLOVE_DELIVERY_FLOW;

export const WHITE_GLOVE_STAGE_LABELS: Partial<Record<TrackingStatus, string>> = {
  en_route_to_pickup: "En route to vendor",
  arrived_at_pickup: "At vendor",
  en_route_to_destination: "In transit",
  arrived_at_destination: "At destination",
  walkthrough_photos: "Final walkthrough",
  completed: "Client sign-off",
};

/** Labels for white-glove IN-HOME jobs (no vendor / no transit, 4-step). */
export const WHITE_GLOVE_INHOME_STAGE_LABELS: Partial<Record<TrackingStatus, string>> = {
  arrived: "Arrive",
  working: "Service in progress",
  walkthrough_photos: "Final walkthrough",
  completed: "Client sign-off",
};

// Office / commercial move. Adds prep + verification around an A→B trunk.
const OFFICE_MOVE_FLOW: TrackingStatus[] = [
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

export const OFFICE_MOVE_STAGE_LABELS: Partial<Record<TrackingStatus, string>> = {
  en_route_to_pickup: "En route to origin",
  arrived_at_pickup: "At origin",
  inventory_check: "Label & plan",
  loading: "Load",
  en_route_to_destination: "In transit",
  arrived_at_destination: "At destination",
  unloading: "Place + IT setup",
  walkthrough_photos: "Verify",
  completed: "Walkthrough",
};

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
 * Crew checkpoint order for a move. The flow is selected by:
 *   - `serviceType` / `moveType` (the primary archetype),
 *   - `whiteGloveKind` ("delivery" vs "service") for white-glove jobs, and
 *   - `sameAddress` as a fallback when kind isn't set (same pickup/drop = in-home).
 *
 * Office moves get their own flow (label-and-plan + IT-setup steps) instead of
 * being aliased to the generic B2B move flow.
 */
export const getCrewStatusFlowForMove = (
  serviceType: string | null | undefined,
  moveType?: string | null,
  opts?: {
    whiteGloveKind?: string | null;
    sameAddress?: boolean;
  },
): TrackingStatus[] => {
  // Office moves are normalized to "b2b_delivery" by the category mapper, so
  // intercept the raw service type BEFORE the bucket lookup to give them a
  // dedicated office flow.
  const rawSt = (serviceType || "").toLowerCase().trim();
  if (rawSt === "office_move") return [...OFFICE_MOVE_FLOW];

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
    case "white_glove": {
      const kind = (opts?.whiteGloveKind || "").toLowerCase().trim();
      // Explicit kind wins. Same-address is the safety net for legacy rows.
      const isInHome =
        kind === "service" || kind === "in_home" || (!kind && opts?.sameAddress === true);
      return isInHome ? [...WHITE_GLOVE_INHOME_FLOW] : [...WHITE_GLOVE_DELIVERY_FLOW];
    }
    case "residential":
      return [...RESIDENTIAL_MOVE_FLOW];
    default:
      return [...RESIDENTIAL_MOVE_FLOW];
  }
};

/** Labels override per archetype. Falls through to the default crew/B2B copy. */
export const getCrewStageLabelsForMove = (
  serviceType: string | null | undefined,
  moveType?: string | null,
  opts?: {
    whiteGloveKind?: string | null;
    sameAddress?: boolean;
  },
): Partial<Record<TrackingStatus, string>> => {
  const rawSt = (serviceType || "").toLowerCase().trim();
  if (rawSt === "office_move") return OFFICE_MOVE_STAGE_LABELS;
  const key = normalizeCrewServiceCategory(serviceType, moveType);
  if (key === "white_glove") {
    const kind = (opts?.whiteGloveKind || "").toLowerCase().trim();
    const isInHome =
      kind === "service" || kind === "in_home" || (!kind && opts?.sameAddress === true);
    return isInHome ? WHITE_GLOVE_INHOME_STAGE_LABELS : WHITE_GLOVE_STAGE_LABELS;
  }
  return {};
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
      ...WHITE_GLOVE_INHOME_FLOW,
      ...OFFICE_MOVE_FLOW,
      ...BIN_RENTAL_FLOW,
      ...BIN_RENTAL_PICKUP_FLOW,
    ].flat(),
  ),
];

/** Allowed tracking statuses for checkpoint API (move + delivery unions). */
export const ALL_KNOWN_TRACKING_STATUSES: readonly string[] = STATUS_UNION;

export const isAllowedTrackingCheckpointStatus = (status: string): boolean =>
  ALL_KNOWN_TRACKING_STATUSES.includes(status);
