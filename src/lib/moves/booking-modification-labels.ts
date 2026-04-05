const TYPE_LABELS: Record<string, string> = {
  date_change: "Move date",
  address_change: "Pickup and delivery addresses",
  tier_change: "Service tier",
  inventory_change: "Inventory",
};

export function labelBookingModificationType(type: string): string {
  const t = String(type || "").trim();
  return TYPE_LABELS[t] ?? t.replace(/_/g, " ");
}
