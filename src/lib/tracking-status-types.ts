/** Shared with tracking notifications, partner SMS, and client SMS helpers. */
export type TrackingStatus =
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "loading"
  | "en_route_to_destination"
  | "arrived_at_destination"
  | "unloading"
  | "completed"
  | "en_route"
  | "arrived"
  | "delivering";
