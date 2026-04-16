/**
 * Safe display helpers so internal DB keys and raw objects never leak into UI.
 */

const DISPLAY_LABELS: Record<string, string> = {
  bin_rental: "Bin rental",
  local_move: "Local move",
  b2b_delivery: "B2B delivery",
  white_glove: "White glove",
  labour_only: "Labour only",
  single_item: "Single item",
  office_move: "Office move",
  event: "Event",
  specialty: "Specialty",
  essential: "Essential",
  signature: "Signature",
  estate: "Estate",
  tenant_move_in: "Tenant move-in",
  tenant_move_out: "Tenant move-out",
  reno_displacement_out: "Renovation move-out",
  reno_return_in: "Renovation return",
  suite_transfer: "Suite transfer",
  unit_turnover: "Unit turnover",
  room_of_choice: "Room of choice",
  threshold: "Threshold",
  "1br": "1 bedroom",
  "2br": "2 bedroom",
  "3br": "3 bedroom",
  "4br": "4 bedroom",
  "4br_plus": "4+ bedroom",
  "5br_plus": "5+ bedroom",
  studio: "Studio",
  walk_up_2nd: "2nd floor walk-up",
  walk_up_3rd: "3rd floor walk-up",
  walk_up_4th: "4th+ floor walk-up",
  ground: "Ground floor",
  elevator: "Elevator",
  loading_dock: "Loading dock",
  concierge: "Concierge",
  long_carry: "Long carry",
  narrow_stairs: "Narrow stairs",
  residential: "Residential",
}

const INTERNAL_ONLY_FIELDS = new Set([
  "id",
  "uuid",
  "created_at",
  "updated_at",
  "deleted_at",
  "hubspot_deal_id",
  "hubspot_contact_id",
  "stripe_customer_id",
  "square_customer_id",
  "square_payment_id",
  "tracking_token",
  "welcome_package_token",
  "approval_token",
  "internal_notes",
  "coordinator_id",
  "crew_ids",
  "payment_error",
  "payment_retry_count",
  "cold_reason",
  "decline_comment",
  "override_reason",
  "override_by",
  "cost_estimate",
  "margin",
  "crew_loaded_hourly_rate",
  "bin_line_items",
  "pricing_debug",
])

export function displayLabel(raw: string): string {
  if (!raw) return ""
  const k = raw.trim().toLowerCase()
  return DISPLAY_LABELS[k] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function safeDisplay(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return "—"
  if (typeof value === "number") return value.toLocaleString()
  return String(value)
}

export function isInternalField(fieldName: string): boolean {
  return INTERNAL_ONLY_FIELDS.has(fieldName)
}
