// Service types
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  residential: "Residential Move",
  office: "Office Move",
  office_move: "Office Relocation",
  single_item: "Delivery",
  white_glove: "White Glove Move",
  specialty: "Specialty Move",
  event: "Event Logistics",
  b2b_one_off: "Delivery",
  b2b_oneoff: "Commercial Delivery",
  b2b_delivery: "Commercial Delivery",
  labour_only: "Labour Service",
  local_move: "Local Move",
  long_distance: "Long Distance Move",
};

// Move statuses
export const MOVE_STATUS_LABELS: Record<string, string> = {
  draft: "Preparing",
  quoted: "Quote Ready",
  sent: "Quote Sent",
  viewed: "Quote Viewed",
  booked: "Confirmed",
  confirmed: "Confirmed",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
  paid: "Paid",
  delivered: "Completed",
  pending: "Confirmed",
  dispatched: "In Progress",
  "in-transit": "In Progress",
  in_transit: "In Progress",
  final_payment_received: "Paid",
};

// Quote statuses
export const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Booked",
};

// Payment statuses
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment Pending",
  deposit_paid: "Deposit Paid",
  paid: "Paid",
  partial: "Partially Paid",
  refunded: "Refunded",
  invoiced: "Invoice Sent",
  overdue: "Overdue",
  draft: "Draft",
  sent: "Sent",
  void: "Void",
};

// Delivery statuses
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  dispatched: "On the Way",
  in_transit: "In Transit",
  "in-transit": "In Transit",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Delivery Issue",
  delayed: "Delayed",
};

// Tier labels (internal keys → client copy)
export const TIER_LABELS: Record<string, string> = {
  essential: "Essential",
  curated: "Essential",
  signature: "Signature",
  estate: "Estate",
  essentials: "Essential",
  premier: "Signature",
};

// Event phases
export const EVENT_PHASE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  setup: "Setup",
  return: "Return",
  single_day: "Same-Day Event",
  to_pickup: "Crew en route to you",
  to_destination: "Your belongings are on the way",
};

// Access types (for display, not internal use)
export const ACCESS_LABELS: Record<string, string> = {
  elevator: "Elevator",
  ground_floor: "Ground Floor",
  loading_dock: "Loading Dock",
  walk_up_2nd: "2nd Floor (Walk-up)",
  walk_up_3rd: "3rd Floor (Walk-up)",
  walk_up_4th: "4th+ Floor (Walk-up)",
  long_carry: "Extended Entrance",
  narrow_stairs: "Narrow Staircase",
  no_parking: "Limited Parking",
};

/** Referral program row status — never show raw enum to clients */
export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
  pending: "Pending",
  redeemed: "Redeemed",
};

/** Valuation / protection tier — internal keys from DB */
export const VALUATION_TIER_LABELS: Record<string, string> = {
  released: "Released Value",
  enhanced: "Enhanced Value",
  full_replacement: "Full Replacement",
};

// Generic formatter — catches anything not in a specific map
export function displayLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type DisplayLabelCategory =
  | "service_type"
  | "status"
  | "payment"
  | "tier"
  | "access"
  | "delivery"
  | "event_phase"
  | "quote"
  | "referral"
  | "valuation";

// Main function: try specific maps first, fall back to generic
export function getDisplayLabel(
  value: string | null | undefined,
  category?: DisplayLabelCategory,
): string {
  if (!value) return "";

  const maps: Record<string, Record<string, string>> = {
    service_type: SERVICE_TYPE_LABELS,
    status: MOVE_STATUS_LABELS,
    payment: PAYMENT_STATUS_LABELS,
    tier: TIER_LABELS,
    access: ACCESS_LABELS,
    delivery: DELIVERY_STATUS_LABELS,
    event_phase: EVENT_PHASE_LABELS,
    quote: QUOTE_STATUS_LABELS,
    referral: REFERRAL_STATUS_LABELS,
    valuation: VALUATION_TIER_LABELS,
  };

  if (category && maps[category]?.[value]) {
    return maps[category]![value]!;
  }

  for (const map of Object.values(maps)) {
    if (map[value]) return map[value]!;
  }

  return displayLabel(value);
}
