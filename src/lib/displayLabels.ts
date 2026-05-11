// Move / home sizes (DB slugs → human labels)
export const MOVE_SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  bachelor: "Bachelor",
  partial: "Partial",
  "1br": "1 Bedroom",
  "2br": "2 Bedrooms",
  "3br": "3 Bedrooms",
  "4br": "4 Bedrooms",
  "4br_plus": "4+ Bedrooms",
  "5br": "5 Bedrooms",
  "5br_plus": "5+ Bedrooms",
  custom: "Custom",
  office_small: "Small Office",
  office_medium: "Medium Office",
  office_large: "Large Office",
};

/**
 * Convert a move_size / home_size slug to a human-readable label.
 * Falls back to title-casing with underscore replacement.
 */
export function moveSizeDisplayLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const v = value.trim();
  return MOVE_SIZE_LABELS[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Service types
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  residential: "Residential Move",
  office: "Office Move",
  office_move: "Office Relocation",
  single_item: "Delivery",
  white_glove: "White Glove Move",
  specialty: "Specialty Move",
  event: "Event Logistics",
  b2b_one_off: "B2B Delivery",
  b2b_oneoff: "B2B Delivery",
  b2b_delivery: "Commercial Delivery",
  labour_only: "Labour Service",
  bin_rental: "Bin Rental",
  local_move: "Local Move",
  long_distance: "Long Distance Move",
  /** Lead inbox / coordinator (not a quote service_type, but shown on same admin surfaces) */
  pm_inquiry: "Property management inquiry",
  /** Virtual slug used when is_pm_move=true to override b2b_oneoff labels */
  pm_move: "PM Move",
};

/**
 * Admin and client quote UI: never show raw `service_type` DB slugs (e.g. `bin_rental`).
 * Prefer this over ad-hoc maps or `displayLabel()` so labels stay consistent.
 */
export function serviceTypeDisplayLabel(value: string | null | undefined): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return "—";
  const fromMap = getDisplayLabel(v, "service_type");
  return fromMap || displayLabel(v);
}

const isB2bOneOffSlug = (raw: string | null | undefined) => {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return v === "b2b_oneoff" || v === "b2b_one_off";
};

/** Portfolio PM batches store `service_type` b2b_oneoff but admin copy must not read as delivery. */
export function portfolioPmMoveServiceLabel(move: {
  service_type?: string | null;
  is_pm_move?: boolean | null;
}): string {
  if (move.is_pm_move && isB2bOneOffSlug(move.service_type)) {
    return "Property management move";
  }
  if (move.is_pm_move) {
    const st = serviceTypeDisplayLabel(move.service_type);
    if (!st.trim() || st === "—") return "Property management move";
    return st;
  }
  return serviceTypeDisplayLabel(move.service_type);
}

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
  ground: "Ground Floor",
  ground_floor: "Ground Floor",
  concierge: "Concierge",
  loading_dock: "Loading Dock",
  walk_up_2: "Walk-up (2nd Floor)",
  walk_up_2nd: "Walk-up (2nd Floor)",
  walk_up_3: "Walk-up (3rd Floor)",
  walk_up_3rd: "Walk-up (3rd Floor)",
  walk_up_4_plus: "Walk-up (4th+ Floor)",
  walk_up_4plus: "Walk-up (4th+ Floor)",
  walk_up_4th: "Walk-up (4th+ Floor)",
  walk_up_4th_plus: "Walk-up (4th+ Floor)",
  long_carry: "Long Carry",
  narrow_stairs: "Narrow Stairs",
  no_parking: "Limited Parking",
};

/** Truck / vehicle types — shown on quote and move detail. */
export const TRUCK_TYPE_LABELS: Record<string, string> = {
  sprinter: "Sprinter Van",
  cargo_van: "Cargo Van",
  "16ft": "16ft Truck",
  "20ft": "20ft Truck",
  "24ft": "24ft Truck",
  "26ft": "26ft Truck",
  "26ft_lift": "26ft Truck w/ Lift",
  none: "No Truck (Labour Only)",
};

/** B2B handling types — vertical-specific delivery handling. */
export const HANDLING_TYPE_LABELS: Record<string, string> = {
  dock_to_dock: "Dock to Dock",
  threshold: "Threshold Drop",
  room_of_choice: "Room of Choice",
  white_glove: "White Glove",
  carry_in: "Carry In",
  hand_bomb: "Hand Bomb",
  skid_drop: "Skid Drop",
};

/** Assembly complexity — item-intelligence detection. */
export const ASSEMBLY_LABELS: Record<string, string> = {
  none: "None",
  simple: "Simple",
  moderate: "Moderate",
  complex: "Complex",
  specialist: "Specialist Required",
  assembly: "Assembly at Delivery",
  disassembly: "Disassembly at Pickup",
  both: "Disassemble & Reassemble",
};

/** Payment methods — used across quotes, invoices, and finance views. */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Credit Card",
  card_at_booking: "Card at Booking",
  cash: "Cash",
  etransfer: "E-Transfer",
  credit_card: "Credit Card",
  cheque: "Cheque",
  invoice: "Invoice",
  offline: "Offline Payment",
  square: "Square",
  other: "Other",
};

/** Partner / organization types (vertical slugs). */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  property_management: "Property Management",
  property_management_residential: "Property Management (Residential)",
  property_management_commercial: "Property Management (Commercial)",
  developer_builder: "Developer / Builder",
  furniture_retail: "Furniture Retailer",
  interior_designer: "Interior Designer",
  flooring: "Flooring",
  cabinetry: "Cabinetry & Fixtures",
  medical: "Medical Equipment",
  appliance: "Appliance Delivery",
  art_gallery: "Art & Gallery",
  restaurant: "Restaurant & Hospitality",
  hospitality: "Hospitality",
  office_furniture: "Office Furniture",
  ecommerce: "E-Commerce",
  referral: "Referral Partner",
  realtor: "Realtor",
  developer: "Developer",
  retail: "Retail",
  b2c: "B2C",
  b2b: "B2B",
};

/** PM move types — reason codes captured in the PM portal. */
export const PM_MOVE_TYPE_LABELS: Record<string, string> = {
  reno_displacement_out: "Renovation Move-Out",
  reno_return_in: "Renovation Return",
  tenant_move_out: "Tenant Move-Out",
  tenant_move_in: "Tenant Move-In",
  suite_transfer: "Suite Transfer",
  unit_turnover: "Unit Turnover",
};

/** Estate / multi-day plan day types. */
export const DAY_TYPE_LABELS: Record<string, string> = {
  pack: "Packing Day",
  move: "Moving Day",
  unpack: "Unpacking Day",
  crating: "Crating Day",
  install: "Install Day",
  cleanup: "Cleanup Day",
  custom: "Custom",
};

/** Partner health classification — derived from move/delivery history. */
export const PARTNER_HEALTH_LABELS: Record<string, string> = {
  active: "Active",
  at_risk: "At Risk",
  churned: "Churned",
  new: "New",
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
  | "valuation"
  | "truck"
  | "handling"
  | "assembly"
  | "payment_method"
  | "partner_type"
  | "pm_move_type"
  | "day_type"
  | "partner_health"
  | "move_size";

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
    truck: TRUCK_TYPE_LABELS,
    handling: HANDLING_TYPE_LABELS,
    assembly: ASSEMBLY_LABELS,
    payment_method: PAYMENT_METHOD_LABELS,
    partner_type: PARTNER_TYPE_LABELS,
    pm_move_type: PM_MOVE_TYPE_LABELS,
    day_type: DAY_TYPE_LABELS,
    partner_health: PARTNER_HEALTH_LABELS,
    move_size: MOVE_SIZE_LABELS,
  };

  if (category && maps[category]?.[value]) {
    return maps[category]![value]!;
  }

  for (const map of Object.values(maps)) {
    if (map[value]) return map[value]!;
  }

  return displayLabel(value);
}
