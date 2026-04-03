// ===================================================================
// Partner Verticals & Profiles
// Verticals grouped by rate card template; three onboarding profiles:
// delivery (ops partners), portfolio (PM / developer buildings), referral (commission)
// ===================================================================

export type PartnerVertical =
  | "furniture_retailer" | "interior_designer" | "cabinetry" | "flooring"
  | "art_gallery" | "antique_dealer"
  | "hospitality"
  | "medical_equipment" | "av_technology" | "appliances"
  | "property_management_residential" | "property_management_commercial" | "developer_builder"
  | "realtor" | "property_manager" | "developer";

export type PartnerProfile = "delivery" | "portfolio" | "referral";

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
    profile: "portfolio",
    label: "Property & Portfolio",
    description: "Buildings, contracts, tenant moves, and property-management portal",
    groups: [
      {
        label: "Property & Portfolio",
        templateSlug: "property_management",
        verticals: [
          { value: "property_management_residential", label: "Property Management (Residential)" },
          { value: "property_management_commercial", label: "Property Management (Commercial)" },
          { value: "developer_builder", label: "Developer / Builder" },
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
export const TEMPLATE_SLUG_LABELS: Record<string, string> = {};
export const ALL_VERTICALS: PartnerVertical[] = [];

for (const segment of PARTNER_SEGMENT_GROUPS) {
  for (const group of segment.groups) {
    TEMPLATE_SLUG_LABELS[group.templateSlug] = group.label;
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
VERTICAL_LABELS["b2c"] = "Move client";
VERTICAL_LABELS["b2b"] = "Business partner";

/**
 * Allowed values for `organizations.type` (Postgres `organizations_type_check`).
 * Keep in sync with `supabase/migrations/*organizations_type*.sql`.
 */
export const ALLOWED_ORGANIZATION_TYPES: readonly string[] = [
  "b2c",
  "b2b",
  "retail",
  "designer",
  "gallery",
  ...ALL_VERTICALS,
];

const ALLOWED_ORGANIZATION_TYPE_SET = new Set<string>(ALLOWED_ORGANIZATION_TYPES);

/** Lowercase trimmed slug for DB `organizations.type` (default: furniture_retailer). */
export function normalizeOrganizationType(raw: unknown): string {
  if (typeof raw !== "string") return "furniture_retailer";
  const s = raw.trim().toLowerCase();
  return s || "furniture_retailer";
}

export function isAllowedOrganizationType(type: string): boolean {
  return ALLOWED_ORGANIZATION_TYPE_SET.has(type);
}

/** Appends fix instructions when Postgres rejects `organizations.type`. */
export function augmentOrganizationsTypeCheckError(message: string): string {
  if (!message.includes("organizations_type_check")) return message;
  return `${message} Your database needs migration 20260402100000_organizations_type_pm_delivery_verticals.sql (or run \`supabase db push\` / paste that file into the Supabase SQL editor).`;
}

const REFERRAL_VERTICALS = new Set<string>(["realtor", "property_manager", "developer"]);

/** Delivery-profile verticals that use the property management partner portal (contracts, buildings, PM moves). */
export const PM_DELIVERY_VERTICALS = new Set<string>([
  "property_management_residential",
  "property_management_commercial",
  "developer_builder",
]);

export function isPropertyManagementDeliveryVertical(type: string): boolean {
  return PM_DELIVERY_VERTICALS.has(resolveVertical(type));
}

/**
 * Partner verticals that receive a self-serve login and dashboard.
 * Referral realtors are coordinated offline — no portal login or in-app referral UI.
 */
export function partnerHasSelfServePortal(type: string): boolean {
  const v = resolveVertical(type);
  if (v === "realtor") return false;
  return true;
}

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

function humanizeUnknownOrganizationType(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * User-facing label for `organizations.type` / `organizations.vertical` (admin + partner UI).
 * Does not emit raw DB slugs when a known mapping exists.
 */
export function organizationTypeLabel(raw: string | null | undefined): string {
  const key = (raw || "").trim().toLowerCase();
  if (!key) return "Partner";
  const resolved = resolveVertical(key);
  const label = VERTICAL_LABELS[resolved] || VERTICAL_LABELS[key];
  if (label) return label;
  return humanizeUnknownOrganizationType(resolved);
}

/**
 * Referral-side org verticals onboarded from the Referral Partners admin hub (`/admin/partners/realtors`),
 * not from the platform partner onboarding wizard (delivery + property & portfolio only).
 */
export const REFERRAL_HUB_ORG_TYPES = ["realtor", "property_manager", "developer"] as const;

export function isReferralHubOrgVertical(type: string): boolean {
  const v = resolveVertical(type);
  return (REFERRAL_HUB_ORG_TYPES as readonly string[]).includes(v);
}

export function getPartnerProfile(type: string): PartnerProfile {
  const v = resolveVertical(type);
  if (PM_DELIVERY_VERTICALS.has(v)) return "portfolio";
  return REFERRAL_VERTICALS.has(v) ? "referral" : "delivery";
}

export function getPartnerFeatures(type: string) {
  const v = resolveVertical(type);
  const profile = getPartnerProfile(type);
  const isDelivery = profile === "delivery";
  const isReferral = profile === "referral";
  const hasSelfServePortal = partnerHasSelfServePortal(type);
  const referralPortal = isReferral && hasSelfServePortal;

  const isDesigner = v === "interior_designer" || v === "designer";
  const isPmPortal = PM_DELIVERY_VERTICALS.has(v);
  return {
    hasSelfServePortal,
    canCreateDelivery: isDelivery && !isPmPortal,
    canSubmitReferral: referralPortal,
    showProjects: v === "interior_designer" || v === "art_gallery" || v === "designer",
    showDayRates: !isDesigner && !isPmPortal,
    showCommission: referralPortal,
    showMoves: v === "interior_designer",
    showDeliveries: isDelivery && !isPmPortal,
    showReferrals: referralPortal,
    showVendorReceiving: v === "interior_designer",
    showMaterials: referralPortal,
    showPropertyManagementPortal: isPmPortal,
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
