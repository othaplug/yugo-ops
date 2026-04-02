/**
 * Central display strings for DB / API enum values shown to admins and clients.
 * Prefer this over raw snake_case in UI.
 */
export const DISPLAY_LABELS: Record<string, string> = {
  // Vehicles
  sprinter: "Sprinter van",
  "16ft": "16ft box truck",
  "20ft": "20ft box truck",
  "24ft": "24ft box truck",
  "26ft": "26ft box truck",

  // Handling (B2B)
  threshold: "Threshold (front door / lobby)",
  room_placement: "Room of choice",
  room_of_choice: "Room of choice",
  white_glove: "White glove",
  carry_in: "Carry in (per unit)",
  hand_bomb: "Hand bomb (individual carry)",
  skid_drop: "Skid drop",

  // Access
  elevator: "Elevator",
  ground_floor: "Ground floor",
  loading_dock: "Loading dock",
  walk_up_2nd: "Walk-up (2nd floor)",
  walk_up_3rd: "Walk-up (3rd floor)",
  walk_up_4th_plus: "Walk-up (4th+ floor)",
  long_carry: "Long carry",
  narrow_stairs: "Narrow stairs",
  no_parking_nearby: "No parking nearby",

  // Service types
  b2b_one_off: "B2B delivery",
  b2b_delivery: "B2B delivery",
  residential: "Residential",
  bin_rental: "Bin rental",
  labour_only: "Labour only",
  single_item: "Single item",
  local_move: "Local move",
  long_distance: "Long distance",
  office_move: "Office move",
  specialty: "Specialty",
  event: "Event",

  // Delivery verticals (common codes)
  furniture_retail: "Furniture retail delivery",
  flooring: "Flooring / building materials",
  designer: "Interior designer projects",
  cabinetry: "Cabinetry and fixtures",
  medical: "Medical / lab equipment",
  appliance: "Appliance delivery",
  art_gallery: "Art and gallery",
  restaurant_hospitality: "Restaurant / hospitality",
  office_furniture: "Office / commercial furniture",
  ecommerce: "E-commerce / bulk delivery",
  custom: "Custom / other",

  // Quote / job statuses
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Canceled",
  declined: "Declined",
  expired: "Expired",
  paid: "Paid",
  in_progress: "In progress",

  // Invoice terms
  on_completion: "Due on job completion",
  net_15: "Net 15 (due 15 days after completion)",
  net_30: "Net 30 (due 30 days after completion)",
};

export function displayLabel(key: string | null | undefined): string {
  if (key == null || key === "") return "";
  const k = String(key).trim().toLowerCase();
  if (DISPLAY_LABELS[k]) return DISPLAY_LABELS[k]!;
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
}
