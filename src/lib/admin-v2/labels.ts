import type {
  B2BPartner,
  BuildingConfig,
  CrewAvailability,
  CrewRole,
  CustomerType,
  InvoiceStatus,
  LeadProbability,
  LeadStatus,
  MoveStatus,
  PMAccount,
  QuoteStatus,
  ResidentialTier,
  ServiceType,
  Vertical,
} from "./mock/types"

// Every module maps DB enum values to a presentation label in ONE place.
// UI never reads the enum directly (see `no-db-vars-in-ui.mdc`). Every
// label is short, title-cased, and consistent with the Meetalo chip system.

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "NEW",
  "pre-sale": "PRE-SALE",
  closing: "CLOSING",
  closed: "CLOSED",
  lost: "LOST",
}

export const LEAD_PROBABILITY_LABEL: Record<LeadProbability, string> = {
  low: "LOW",
  mid: "MID",
  high: "HIGH",
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "DRAFT",
  sent: "SENT",
  viewed: "VIEWED",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  expired: "EXPIRED",
}

export const MOVE_STATUS_LABEL: Record<MoveStatus, string> = {
  draft: "DRAFT",
  scheduled: "SCHEDULED",
  "pre-move": "PRE-MOVE",
  "in-transit": "IN TRANSIT",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "DRAFT",
  sent: "SENT",
  paid: "PAID",
  overdue: "OVERDUE",
  void: "VOID",
  refunded: "REFUNDED",
}

export const TIER_LABEL: Record<ResidentialTier, string> = {
  essential: "Essential",
  signature: "Signature",
  estate: "Estate",
}

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  move: "Move",
  delivery: "Delivery",
  bin_rental: "Bin rental",
  storage: "Storage",
}

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  b2c: "B2C",
  b2b: "B2B",
  pm: "PM",
}

export const VERTICAL_LABEL: Record<Vertical, string> = {
  furniture_retail: "Furniture retail",
  flooring: "Flooring",
  interior_designer: "Interior designer",
  cabinetry: "Cabinetry",
  medical_lab: "Medical / Lab",
  appliance: "Appliance",
  art_gallery: "Art / Gallery",
  restaurant_hospitality: "Restaurant / Hospitality",
  office_commercial: "Office / Commercial",
  ecommerce_bulk: "E-commerce / Bulk",
  property_management: "Property management",
}

export const CREW_ROLE_LABEL: Record<CrewRole, string> = {
  lead: "Lead",
  mover: "Mover",
  driver: "Driver",
}

export const CREW_AVAILABILITY_LABEL: Record<CrewAvailability, string> = {
  available: "AVAILABLE",
  "on-move": "ON MOVE",
  "off-duty": "OFF DUTY",
}

export const BUILDING_CONFIG_LABEL: Record<BuildingConfig, string> = {
  standard: "Standard",
  split_transfer: "Split transfer",
  multi_transfer: "Multi transfer",
}

export const B2B_STATUS_LABEL: Record<B2BPartner["status"], string> = {
  active: "ACTIVE",
  paused: "PAUSED",
  archived: "ARCHIVED",
}

export const PM_CONTRACT_LABEL: Record<PMAccount["contractStatus"], string> = {
  active: "ACTIVE",
  renewal: "RENEWAL",
  lapsed: "LAPSED",
}
