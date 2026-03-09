// ===================================================================
// Partner Verticals & Profiles
// 12 verticals → 2 dashboard profiles (delivery / referral)
// Verticals grouped by rate card template for pricing
// ===================================================================

export type PartnerVertical =
  | "furniture_retailer" | "interior_designer" | "cabinetry" | "flooring"
  | "art_gallery" | "antique_dealer"
  | "hospitality"
  | "medical_equipment" | "av_technology" | "appliances"
  | "realtor" | "property_manager" | "developer";

export type PartnerProfile = "delivery" | "referral";

/** @deprecated Use PartnerVertical */
export type PartnerType = PartnerVertical;

export const PARTNER_SEGMENT_GROUPS: {
  profile: PartnerProfile;
  label: string;
  description: string;
  groups: {
    label: string;
    templateSlug: string;
    verticals: { value: PartnerVertical; label: string }[];
  }[];
}[] = [
  {
    profile: "delivery",
    label: "Delivery Partners",
    description: "Schedule deliveries, day rates, calendar, live map, invoices, analytics",
    groups: [
      {
        label: "Furniture & Design",
        templateSlug: "furniture_design",
        verticals: [
          { value: "furniture_retailer", label: "Furniture Retailer" },
          { value: "interior_designer", label: "Interior Designer" },
          { value: "cabinetry", label: "Cabinetry" },
          { value: "flooring", label: "Flooring" },
        ],
      },
      {
        label: "Art & Specialty",
        templateSlug: "art_specialty",
        verticals: [
          { value: "art_gallery", label: "Art Gallery" },
          { value: "antique_dealer", label: "Antique Dealer" },
        ],
      },
      {
        label: "Hospitality & Commercial",
        templateSlug: "hospitality_commercial",
        verticals: [
          { value: "hospitality", label: "Hospitality" },
        ],
      },
      {
        label: "Medical & Technical",
        templateSlug: "medical_technical",
        verticals: [
          { value: "medical_equipment", label: "Medical Equipment" },
          { value: "av_technology", label: "AV / Technology" },
          { value: "appliances", label: "Appliances" },
        ],
      },
    ],
  },
  {
    profile: "referral",
    label: "Referral Partners",
    description: "Referral submission, commission tracking, materials",
    groups: [
      {
        label: "Referral Partners",
        templateSlug: "referral",
        verticals: [
          { value: "realtor", label: "Realtor" },
          { value: "property_manager", label: "Property Manager" },
          { value: "developer", label: "Developer" },
        ],
      },
    ],
  },
];

// Build lookup maps from segment groups
export const VERTICAL_LABELS: Record<string, string> = {};
export const VERTICAL_TO_TEMPLATE_SLUG: Record<string, string> = {};
export const ALL_VERTICALS: PartnerVertical[] = [];

for (const segment of PARTNER_SEGMENT_GROUPS) {
  for (const group of segment.groups) {
    for (const v of group.verticals) {
      VERTICAL_LABELS[v.value] = v.label;
      VERTICAL_TO_TEMPLATE_SLUG[v.value] = group.templateSlug;
      ALL_VERTICALS.push(v.value);
    }
  }
}

// Backward-compat labels for legacy org types still in DB
VERTICAL_LABELS["retail"] = "Retail";
VERTICAL_LABELS["designer"] = "Designer";
VERTICAL_LABELS["gallery"] = "Gallery";

const REFERRAL_VERTICALS = new Set<string>(["realtor", "property_manager", "developer"]);

const LEGACY_TYPE_MAP: Record<string, PartnerVertical> = {
  retail: "furniture_retailer",
  designer: "interior_designer",
  gallery: "art_gallery",
};

/** Resolve legacy org types (retail, designer, gallery) to canonical vertical */
export function resolveVertical(raw: string): string {
  const t = (raw || "furniture_retailer").toLowerCase();
  return LEGACY_TYPE_MAP[t] || t;
}

export function getPartnerProfile(type: string): PartnerProfile {
  const v = resolveVertical(type);
  return REFERRAL_VERTICALS.has(v) ? "referral" : "delivery";
}

export function getPartnerFeatures(type: string) {
  const v = resolveVertical(type);
  const profile = getPartnerProfile(type);
  const isDelivery = profile === "delivery";
  const isReferral = profile === "referral";

  return {
    canCreateDelivery: isDelivery,
    canSubmitReferral: isReferral,
    showProjects: v === "interior_designer" || v === "art_gallery",
    showCommission: isReferral,
    showMoves: v === "interior_designer",
    showDeliveries: isDelivery,
    showReferrals: isReferral,
    showVendorReceiving: v === "interior_designer",
    showMaterials: isReferral,
  };
}

export function getPartnerGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function getPartnerTabs(type: string): { key: string; label: string }[] {
  const profile = getPartnerProfile(type);
  if (profile === "referral") {
    return [
      { key: "active", label: "Active" },
      { key: "completed", label: "Completed" },
      { key: "materials", label: "Materials" },
    ];
  }
  return [
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "calendar", label: "Calendar" },
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
