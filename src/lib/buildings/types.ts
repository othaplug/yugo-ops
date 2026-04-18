export type BuildingElevatorSystem =
  | "standard"
  | "split_transfer"
  | "multi_transfer"
  | "no_freight"
  | "stairs_only"

export type BuildingProfileRow = {
  id: string
  address: string
  postal_code: string | null
  building_name: string | null
  management_company: string | null
  latitude: number | null
  longitude: number | null
  building_type: string | null
  elevator_system: string | null
  freight_elevator: boolean | null
  freight_elevator_location: string | null
  residential_elevator_location: string | null
  transfer_floors: string[] | null
  total_elevator_transfers: number | null
  estimated_extra_minutes_per_trip: number | null
  complexity_rating: number | null
  loading_dock: boolean | null
  loading_dock_location: string | null
  loading_dock_restrictions: string | null
  loading_dock_booking_required: boolean | null
  has_commercial_tenants: boolean | null
  commercial_tenants: string[] | null
  move_hours: string | null
  elevator_booking_required: boolean | null
  elevator_max_hours: number | null
  elevator_shared: boolean | null
  hallway_width: string | null
  doorway_dimensions: string | null
  max_item_length: string | null
  freight_elevator_dimensions: string | null
  parking_type: string | null
  parking_notes: string | null
  total_floors: number | null
  total_units: number | null
  residential_floors: string | null
  commercial_floors: string | null
  crew_notes: string | null
  coordinator_notes: string | null
  photo_urls: string[] | null
  source: string | null
  verified: boolean | null
  verified_at: string | null
  verified_by: string | null
  times_moved_here: number | null
  last_move_date: string | null
  created_at: string | null
  updated_at: string | null
}

/** Coordinator or client checklist flags when no DB profile exists */
export type BuildingAccessFlag =
  | "commercial_tenants"
  | "multi_elevator_transfer"
  | "dock_restrictions"
  | "high_floor"
  | "older_small_elevator"

const FLAG_SET = new Set<string>([
  "commercial_tenants",
  "multi_elevator_transfer",
  "dock_restrictions",
  "high_floor",
  "older_small_elevator",
])

export function parseBuildingAccessFlags(raw: unknown): BuildingAccessFlag[] {
  if (!Array.isArray(raw)) return []
  const out: BuildingAccessFlag[] = []
  for (const x of raw) {
    if (typeof x === "string" && FLAG_SET.has(x)) out.push(x as BuildingAccessFlag)
  }
  return out
}
