/** Human labels for delivery stop fields shown in admin and crew UIs */

export const ACCESS_TYPE_LABELS: Record<string, string> = {
  elevator: "Elevator",
  ground_floor: "Ground floor",
  loading_dock: "Loading dock",
  walk_up_2: "Walk-up (2 flights)",
  walk_up_3: "Walk-up (3 flights)",
  walk_up_4_plus: "Walk-up (4+ flights)",
  long_carry: "Long carry",
  narrow_stairs: "Narrow stairs",
  no_parking: "No parking",
}

export const formatStopAccess = (raw: string | null | undefined): string => {
  if (!raw) return ""
  const k = raw.toLowerCase().trim()
  return ACCESS_TYPE_LABELS[k] || raw.replace(/_/g, " ")
}

/** Vendor readiness on a pickup stop */
export const STOP_READINESS_LABELS: Record<string, string> = {
  confirmed: "Ready",
  pending: "Pending",
  partial: "Partial",
  delayed: "Delayed",
}

export const formatStopReadiness = (raw: string | null | undefined): string => {
  if (!raw) return ""
  const k = raw.toLowerCase().trim()
  return STOP_READINESS_LABELS[k] || raw.replace(/_/g, " ")
}

/** Line item status on crew checklist */
export const DELIVERY_STOP_ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  picked_up: "Picked up",
  loaded: "Loaded",
  delivered: "Delivered",
  damaged: "Damaged",
  missing: "Missing",
}

export const formatDeliveryStopItemStatus = (raw: string | null | undefined): string => {
  const k = String(raw || "pending").toLowerCase().trim()
  return DELIVERY_STOP_ITEM_STATUS_LABELS[k] || k.replace(/_/g, " ")
}
