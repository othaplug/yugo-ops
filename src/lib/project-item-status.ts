export const VALID_PROJECT_ITEM_STATUSES = [
  "spec_selected",
  "ordered",
  "in_production",
  "ready_for_pickup",
  "shipped",
  "in_transit",
  "received_warehouse",
  "inspected",
  "stored",
  "scheduled_delivery",
  "delivered",
  "installed",
  "issue_reported",
] as const;

export type ProjectItemStatus = (typeof VALID_PROJECT_ITEM_STATUSES)[number];

export const PROJECT_ITEM_STATUS_LABELS: Record<ProjectItemStatus, string> = {
  spec_selected: "Spec'd",
  ordered: "Ordered",
  in_production: "In Production",
  ready_for_pickup: "Ready for Pickup",
  shipped: "Shipped",
  in_transit: "In Transit",
  received_warehouse: "Received",
  inspected: "Inspected",
  stored: "Stored",
  scheduled_delivery: "Delivery Scheduled",
  delivered: "Delivered",
  installed: "Installed",
  issue_reported: "Issue Reported",
};

export const PROJECT_ITEM_STATUS_UI: Record<ProjectItemStatus, { label: string; color: string; bg: string }> = {
  spec_selected: { label: "Spec'd", color: "text-[#888]", bg: "bg-[#888]/10" },
  ordered: { label: "Ordered", color: "text-blue-500", bg: "bg-blue-500/10" },
  in_production: { label: "In Production", color: "text-blue-500", bg: "bg-blue-500/10" },
  ready_for_pickup: { label: "Ready for Pickup", color: "text-amber-500", bg: "bg-amber-500/10" },
  shipped: { label: "Shipped", color: "text-sky-500", bg: "bg-sky-500/10" },
  in_transit: { label: "In Transit", color: "text-sky-500", bg: "bg-sky-500/10" },
  received_warehouse: { label: "Received", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  inspected: { label: "Inspected", color: "text-emerald-600", bg: "bg-emerald-500/10" },
  stored: { label: "Stored", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  scheduled_delivery: { label: "Delivery Scheduled", color: "text-amber-500", bg: "bg-amber-500/10" },
  delivered: { label: "Delivered", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  installed: { label: "Installed", color: "text-emerald-600", bg: "bg-emerald-600/10" },
  issue_reported: { label: "Issue Reported", color: "text-red-500", bg: "bg-red-500/10" },
};

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  yugo_pickup: "Yugo Pickup",
  vendor_delivers_to_site: "Vendor Delivers to Site",
  vendor_delivers_to_warehouse: "Vendor Delivers to Warehouse",
  shipped_carrier: "Shipped via Carrier",
  client_self: "Client Self-Arrange",
};

export const PROJECT_ITEM_TRANSIT_STATUSES: ProjectItemStatus[] = ["shipped", "in_transit"];
export const PROJECT_ITEM_WAREHOUSE_STATUSES: ProjectItemStatus[] = ["received_warehouse", "inspected", "stored"];
export const PROJECT_ITEM_RECEIVED_STATUSES: ProjectItemStatus[] = [
  "received_warehouse",
  "inspected",
  "stored",
  "scheduled_delivery",
  "delivered",
  "installed",
];

const LEGACY_TO_PROJECT_ITEM_STATUS: Record<string, ProjectItemStatus> = {
  expected: "ordered",
  shipped: "shipped",
  received: "received_warehouse",
  inspected: "inspected",
  stored: "stored",
  scheduled_for_delivery: "scheduled_delivery",
  delivered: "delivered",
  installed: "installed",
  returned: "issue_reported",
  damaged: "issue_reported",
};

const PROJECT_ITEM_STATUS_TO_LEGACY: Record<ProjectItemStatus, string> = {
  spec_selected: "expected",
  ordered: "expected",
  in_production: "expected",
  ready_for_pickup: "expected",
  shipped: "shipped",
  in_transit: "shipped",
  received_warehouse: "received",
  inspected: "inspected",
  stored: "stored",
  scheduled_delivery: "scheduled_for_delivery",
  delivered: "delivered",
  installed: "installed",
  issue_reported: "damaged",
};

export function isValidProjectItemStatus(value: unknown): value is ProjectItemStatus {
  return typeof value === "string" && VALID_PROJECT_ITEM_STATUSES.includes(value as ProjectItemStatus);
}

export function getProjectItemStatus(item: { item_status?: string | null; status?: string | null }): ProjectItemStatus {
  if (isValidProjectItemStatus(item.item_status)) return item.item_status;
  return getProjectItemStatusFromLegacy(item.status);
}

export function getProjectItemStatusFromLegacy(status: string | null | undefined): ProjectItemStatus {
  return LEGACY_TO_PROJECT_ITEM_STATUS[status || ""] || "ordered";
}

export function getLegacyStatusFromProjectItemStatus(status: ProjectItemStatus): string {
  return PROJECT_ITEM_STATUS_TO_LEGACY[status];
}

export function getProjectItemStatusLabel(status: string | null | undefined): string {
  const normalized = isValidProjectItemStatus(status) ? status : getProjectItemStatusFromLegacy(status);
  return PROJECT_ITEM_STATUS_LABELS[normalized];
}

export function getProjectItemStatusUi(status: string | null | undefined) {
  const normalized = isValidProjectItemStatus(status) ? status : getProjectItemStatusFromLegacy(status);
  return PROJECT_ITEM_STATUS_UI[normalized];
}

export function deriveHandledByFromDeliveryMethod(deliveryMethod: string | null | undefined) {
  if (deliveryMethod === "yugo_pickup") return "yugo";
  if (deliveryMethod === "shipped_carrier") return "other_carrier";
  return "vendor_direct";
}
