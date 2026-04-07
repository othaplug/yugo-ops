/**
 * Partner portal copy keyed by `organizations.vertical` / `type`.
 * Keeps trade-specific language (flooring vs furniture vs HVAC) out of generic UI strings.
 */

import { resolveVertical } from "@/lib/partner-type";

export type DeliveryTypeRow = { value: string; label: string; desc: string };

export type PartnerPortalTerminology = {
  /** Title case: Project, Job */
  coordinationTitle: string;
  /** Title case plural: Projects, Jobs */
  coordinationPlural: string;
  /** Lowercase singular for errors: project, job */
  coordinationLower: string;
  /** Lowercase plural: projects, jobs */
  coordinationPluralLower: string;
  /** Phrase: "the project" / "the job" */
  coordinationPhrase: string;
  /** Designer hero when no deliveries today */
  designerDashboardSubtitle: string;
  activeCoordinationSummary: (count: number, hasVendorDelay: boolean) => string;
  b2bTabWithCount: (count: number) => string;
  newCoordinationCta: string;
  newCoordinationSubtitle: string;
  scheduleDeliveryTitle: string;
  scheduleDeliverySubtitle: string;
  calendarEmptyNoDeliveries: string;
  galleryLegacyEmpty: string;
  /** Calendar + list rows: `N UNITS | name` */
  formatItemCountPipe: (count: number, rest: string) => string;
  deliveryTypeRows: DeliveryTypeRow[];
  complexityPresetOptions: string[];
  /** Placeholder for first line in add-item modal */
  addItemPlaceholder: string;
};

const FURNITURE_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Item", desc: "One piece of furniture" },
  { value: "multi_piece", label: "Multi-Piece", desc: "2–5 items, same drop" },
  { value: "full_room", label: "Full Room Setup", desc: "Complete room delivery + setup" },
  { value: "curbside", label: "Curbside Drop", desc: "Drop at building entrance" },
  { value: "oversized", label: "Oversized / Fragile", desc: "Piano, safe, art, etc." },
];

const FLOORING_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Carton / Roll", desc: "One carton, roll, or bundle" },
  { value: "multi_piece", label: "Multi-Carton", desc: "Multiple cartons, same site" },
  { value: "full_room", label: "Full Install Load", desc: "Full room material delivery + placement" },
  { value: "curbside", label: "Curbside / Dock", desc: "Drop at dock or entrance" },
  { value: "oversized", label: "Oversized / Specialty", desc: "Long runs, stair carries, fragile material" },
];

const CABINETRY_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Unit", desc: "One cabinet or boxed run" },
  { value: "multi_piece", label: "Multi-Unit", desc: "Several units, same site" },
  { value: "full_room", label: "Full Kitchen / Millwork", desc: "Complete cabinet delivery + setup" },
  { value: "curbside", label: "Curbside Drop", desc: "Drop at building entrance" },
  { value: "oversized", label: "Oversized / Fragile", desc: "Large panels, glass fronts, etc." },
];

const ART_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Piece", desc: "One artwork or object" },
  { value: "multi_piece", label: "Multi-Piece", desc: "2–5 pieces, same venue" },
  { value: "full_room", label: "Full Placement", desc: "Full room or exhibition install" },
  { value: "curbside", label: "Dock / Entrance", desc: "Drop at loading or entrance" },
  { value: "oversized", label: "Oversized / Crated", desc: "Crated art, sculpture, etc." },
];

const MEDICAL_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Unit", desc: "One device or machine" },
  { value: "multi_piece", label: "Multi-Unit", desc: "Several units, same facility" },
  { value: "full_room", label: "Suite / Room", desc: "Full room equipment delivery" },
  { value: "curbside", label: "Dock / Receiving", desc: "Drop at receiving or dock" },
  { value: "oversized", label: "Oversized / Sensitive", desc: "Large or calibrated equipment" },
];

const HVAC_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Unit", desc: "One furnace, air handler, or major component" },
  { value: "multi_piece", label: "Multi-Unit", desc: "2–5 units or coils, same site" },
  { value: "full_room", label: "Full System", desc: "Complete system delivery + placement" },
  { value: "curbside", label: "Curbside / Dock", desc: "Drop at loading area" },
  { value: "oversized", label: "Oversized / Rooftop", desc: "RTU, large air handlers, etc." },
];

const APPLIANCE_DELIVERY_TYPES: DeliveryTypeRow[] = [
  { value: "single_item", label: "Single Appliance", desc: "One refrigerator, range, washer, etc." },
  { value: "multi_piece", label: "Multi-Appliance", desc: "Several appliances, same site" },
  { value: "full_room", label: "Full Kitchen Set", desc: "Full suite delivery + placement" },
  { value: "curbside", label: "Curbside Drop", desc: "Drop at building entrance" },
  { value: "oversized", label: "Oversized / Built-In", desc: "Panels, oversized units, etc." },
];

function itemWordUpper(
  n: number,
  singular: string,
  plural: string,
): string {
  return n === 1 ? singular.toUpperCase() : plural.toUpperCase();
}

function formatPipe(
  count: number,
  rest: string,
  singular: string,
  plural: string,
): string {
  const n = Math.floor(Math.max(0, count));
  if (n <= 0) return rest;
  return `${n} ${itemWordUpper(n, singular, plural)} | ${rest}`;
}

function projectTerms(
  overrides: Partial<PartnerPortalTerminology> & {
    formatItemCountPipe: PartnerPortalTerminology["formatItemCountPipe"];
    deliveryTypeRows: DeliveryTypeRow[];
    complexityPresetOptions: string[];
    addItemPlaceholder: string;
  },
): PartnerPortalTerminology {
  return {
    coordinationTitle: "Project",
    coordinationPlural: "Projects",
    coordinationLower: "project",
    coordinationPluralLower: "projects",
    coordinationPhrase: "the project",
    designerDashboardSubtitle: "Your projects and deliveries dashboard",
    activeCoordinationSummary: (count, hasVendorDelay) => {
      const s =
        count === 1 ? "1 active project" : `${count} active projects`;
      return hasVendorDelay ? `${s} · 1 vendor delay requiring attention` : s;
    },
    b2bTabWithCount: (count) => `Projects (${count})`,
    newCoordinationCta: "New project",
    newCoordinationSubtitle: "Coordinate multi-vendor items",
    scheduleDeliveryTitle: "Schedule delivery",
    scheduleDeliverySubtitle: "Single or multi-stop delivery",
    calendarEmptyNoDeliveries: "No deliveries or projects scheduled",
    galleryLegacyEmpty: "No active projects.",
    ...overrides,
  };
}

function jobTerms(
  overrides: Partial<PartnerPortalTerminology> & {
    formatItemCountPipe: PartnerPortalTerminology["formatItemCountPipe"];
    deliveryTypeRows: DeliveryTypeRow[];
    complexityPresetOptions: string[];
    addItemPlaceholder: string;
    designerDashboardSubtitle?: string;
    activeCoordinationSummary?: PartnerPortalTerminology["activeCoordinationSummary"];
  },
): PartnerPortalTerminology {
  return projectTerms({
    coordinationTitle: "Job",
    coordinationPlural: "Jobs",
    coordinationLower: "job",
    coordinationPluralLower: "jobs",
    coordinationPhrase: "the job",
    designerDashboardSubtitle:
      overrides.designerDashboardSubtitle ?? "Your jobs and deliveries dashboard",
    activeCoordinationSummary:
      overrides.activeCoordinationSummary ??
      ((count, hasVendorDelay) => {
        const s = count === 1 ? "1 active job" : `${count} active jobs`;
        return hasVendorDelay ? `${s} · 1 vendor delay requiring attention` : s;
      }),
    b2bTabWithCount: (count) => `Jobs (${count})`,
    newCoordinationCta: "New job",
    newCoordinationSubtitle: "Coordinate multi-vendor deliveries",
    calendarEmptyNoDeliveries: "No deliveries or jobs scheduled",
    galleryLegacyEmpty: "No active jobs.",
    ...overrides,
  });
}

export function getPartnerPortalTerminology(rawVertical: string): PartnerPortalTerminology {
  const v = resolveVertical(rawVertical || "");

  switch (v) {
    case "flooring":
      return jobTerms({
        designerDashboardSubtitle: "Your flooring jobs and deliveries dashboard",
        deliveryTypeRows: FLOORING_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "Stairs",
          "Fragile Material",
          "Long Runs",
          "Dock Only",
          "Storage Hold",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "carton", "cartons"),
        addItemPlaceholder: "e.g. LVP 7″ × 48″, 12 cartons",
      });

    case "cabinetry":
      return jobTerms({
        designerDashboardSubtitle: "Your installation jobs and deliveries dashboard",
        deliveryTypeRows: CABINETRY_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "High Value",
          "Glass Fronts",
          "Stairs",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "unit", "units"),
        addItemPlaceholder: "e.g. Wall cabinets — run A, 4 boxes",
      });

    case "medical_equipment":
      return jobTerms({
        designerDashboardSubtitle: "Your equipment jobs and deliveries dashboard",
        deliveryTypeRows: MEDICAL_DELIVERY_TYPES,
        complexityPresetOptions: [
          "Clinical",
          "High Value",
          "Calibrated",
          "Biomed Assist",
          "Dock Only",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "unit", "units"),
        addItemPlaceholder: "e.g. Patient lift — model / serial",
      });

    case "hvac":
      return jobTerms({
        designerDashboardSubtitle: "Your HVAC jobs and deliveries dashboard",
        deliveryTypeRows: HVAC_DELIVERY_TYPES,
        complexityPresetOptions: [
          "Rooftop",
          "Fragile Coil",
          "Stairs",
          "Dock Only",
          "White Glove",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "unit", "units"),
        addItemPlaceholder: "e.g. 3-ton heat pump — model",
      });

    case "av_technology":
      return jobTerms({
        designerDashboardSubtitle: "Your AV and technology jobs dashboard",
        deliveryTypeRows: [
          { value: "single_item", label: "Single Unit", desc: "One rack, display, or component" },
          { value: "multi_piece", label: "Multi-Unit", desc: "Several units, same site" },
          { value: "full_room", label: "Full Room", desc: "Full room install delivery + placement" },
          { value: "curbside", label: "Curbside / Dock", desc: "Drop at loading area" },
          { value: "oversized", label: "Oversized / Sensitive", desc: "Large displays, video walls, etc." },
        ],
        complexityPresetOptions: [
          "Rack Mount",
          "High Value",
          "Fragile Screen",
          "Stairs",
          "Dock Only",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "unit", "units"),
        addItemPlaceholder: "e.g. 85″ display — line item",
      });

    case "appliances":
      return jobTerms({
        designerDashboardSubtitle: "Your appliance jobs and deliveries dashboard",
        deliveryTypeRows: APPLIANCE_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "High Value",
          "Stairs",
          "Built-In",
          "Dock Only",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "unit", "units"),
        addItemPlaceholder: "e.g. 36″ French-door refrigerator",
      });

    case "art_gallery":
    case "antique_dealer":
    case "gallery":
      return projectTerms({
        designerDashboardSubtitle: "Your projects and deliveries dashboard",
        deliveryTypeRows: ART_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "High Value",
          "Crated",
          "Climate",
          "Artwork",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "piece", "pieces"),
        addItemPlaceholder: "e.g. Oil on canvas — 48 × 60″ framed",
      });

    case "interior_designer":
    case "designer":
      return projectTerms({
        designerDashboardSubtitle: "Your projects and deliveries dashboard",
        deliveryTypeRows: FURNITURE_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "High Value",
          "Fragile",
          "Design Install",
          "Receiving",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "piece", "pieces"),
        addItemPlaceholder: "e.g. Lounge sectional — vendor PO",
      });

    case "hospitality":
    case "developer":
      return projectTerms({
        designerDashboardSubtitle: "Your projects and deliveries dashboard",
        deliveryTypeRows: FURNITURE_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "FF&E",
          "After Hours",
          "Dock Only",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "piece", "pieces"),
        addItemPlaceholder: "e.g. Guest room package — SKU list",
      });

    case "furniture_retailer":
    case "retail":
    case "b2b":
    default:
      return projectTerms({
        designerDashboardSubtitle: "Your projects and deliveries dashboard",
        deliveryTypeRows: FURNITURE_DELIVERY_TYPES,
        complexityPresetOptions: [
          "White Glove",
          "High Value",
          "Fragile",
          "Artwork",
          "Antiques",
          "Storage",
        ],
        formatItemCountPipe: (count, rest) => formatPipe(count, rest, "piece", "pieces"),
        addItemPlaceholder: "e.g. Cloud Sectional Sofa",
      });
  }
}
