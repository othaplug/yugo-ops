export type PartnerType = "retail" | "designer" | "gallery" | "realtor";

export function getPartnerFeatures(type: string) {
  const t = (type || "retail").toLowerCase();
  return {
    canCreateDelivery: ["retail", "designer", "gallery"].includes(t),
    canSubmitReferral: t === "realtor",
    showProjects: t === "designer" || t === "gallery",
    showCommission: t === "realtor",
    showMoves: t === "designer",
    showDeliveries: ["retail", "designer", "gallery"].includes(t),
    showReferrals: t === "realtor",
    showVendorReceiving: t === "designer",
    showMaterials: t === "realtor",
  };
}

export function getPartnerGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function getPartnerTabs(type: string): { key: string; label: string }[] {
  const t = (type || "retail").toLowerCase();
  const base = [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "calendar", label: "Calendar" },
  ];
  if (t === "realtor") {
    return [
      { key: "active", label: "Active" },
      { key: "completed", label: "Completed" },
      { key: "materials", label: "Materials" },
    ];
  }
  return [
    ...base,
    { key: "tracking", label: "Live Map" },
    { key: "invoices", label: "Invoices" },
    { key: "billing", label: "Billing" },
  ];
}

export const DELIVERY_TIMELINE_STEPS = [
  { key: "scheduled", label: "Scheduled" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In Transit" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Confirmed" },
];

export function getDeliveryTimelineIndex(status: string): number {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const map: Record<string, number> = {
    scheduled: 0,
    confirmed: 1,
    dispatched: 2,
    in_transit: 3,
    delivered: 4,
    completed: 5,
  };
  return map[s] ?? -1;
}
