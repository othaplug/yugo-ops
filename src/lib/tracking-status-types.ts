/** Shared with tracking notifications, partner SMS, crew portal, and checkpoint API. */
export type TrackingStatus =
  | "not_started"
  | "en_route_to_pickup"
  | "arrived_at_pickup"
  | "inventory_check"
  | "loading"
  | "wrapping"
  | "en_route_to_destination"
  | "en_route_venue"
  | "arrived_at_destination"
  | "arrived_venue"
  | "unloading"
  | "unloading_setup"
  | "event_active"
  | "teardown"
  | "loading_return"
  | "en_route_return"
  | "unloading_return"
  | "unwrapping_placement"
  | "walkthrough_photos"
  | "working"
  | "delivering_bins"
  | "collecting_bins"
  | "completed"
  | "en_route"
  | "arrived"
  | "delivering"
  /* ── Office move Day 1 (pack day) ──
     Added 2026-06-30 for the office relocation crew flow. Day 1
     mirrors the on-site preparation an Estate crew walks through,
     tailored for commercial: initial site walkthrough with the
     client's office manager, IT documentation (borrowed from the
     Estate photo-inventory pattern but scoped to workstations +
     server racks), then packing. Day 2 uses the generic move flow
     (en_route_to_pickup ... completed) with an added 'setup'
     stage. */
  | "initial_walkthrough"
  | "it_documentation"
  | "packing_started"
  | "packing_complete"
  | "setup";
