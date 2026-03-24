/** Human-readable labels for inbound_shipments.status (never show raw DB values in client UI). */

export const INBOUND_SHIPMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_shipment: "Awaiting shipment",
  in_transit: "In transit",
  received: "Received at facility",
  inspecting: "Inspecting",
  inspection_failed: "Inspection issue",
  stored: "In storage",
  customer_contacted: "Customer contacted",
  delivery_scheduled: "Delivery scheduled",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const INBOUND_INSPECTION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  good: "Good condition",
  damaged: "Damage noted",
  partial_damage: "Partial damage",
};

export const INBOUND_SERVICE_LEVEL_LABELS: Record<string, string> = {
  standard: "Standard",
  white_glove: "White glove",
  premium: "Premium",
};

export const INBOUND_BILLING_LABELS: Record<string, string> = {
  partner: "Partner",
  customer: "Customer",
  split: "Split",
};

export const INBOUND_RECEIVING_TIER_LABELS: Record<string, string> = {
  standard: "Standard inspection",
  detailed: "Detailed inspection",
};

export const INBOUND_ASSEMBLY_COMPLEXITY_LABELS: Record<string, string> = {
  simple: "Simple",
  moderate: "Moderate",
  complex: "Complex",
};
