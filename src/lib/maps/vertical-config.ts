export type VerticalConfigEntry = {
  label: string;
  baseRate: number;
  perPiece: number;
  included: number;
  quickAdd: string[];
};

/**
 * Labels + quick-add presets for the coverage map UI.
 * Pricing uses the live dimensional engine (`computeB2BDimensionalForOrg`); these
 * numbers are legacy fallbacks only.
 */
export const VERTICAL_CONFIG: Record<string, VerticalConfigEntry> = {
  furniture_retail: {
    label: "Furniture retail",
    baseRate: 175,
    perPiece: 30,
    included: 3,
    quickAdd: [
      "Sofa (3-seat)",
      "Sectional (component)",
      "Loveseat",
      "Dining table",
      "Dining chairs (set)",
      "Bed frame (queen)",
      "Mattress & foundation",
      "Dresser",
      "Chest of drawers",
      "Nightstand",
      "Coffee table",
      "Side table",
      "Bookshelf",
      "TV stand / media unit",
      "Armchair",
      "Ottoman",
      "Entry bench",
      "Wardrobe / armoire",
      "Office desk",
      "Office chair",
    ],
  },
  flooring: {
    label: "Flooring / building materials",
    baseRate: 150,
    perPiece: 18,
    included: 5,
    quickAdd: [
      "Hardwood flooring (boxes)",
      "Engineered hardwood (boxes)",
      "Laminate (boxes)",
      "Vinyl plank (boxes)",
      "Tile (boxes)",
      "Large format tile",
      "Mortar / adhesive (bags)",
      "Grout",
      "Underlayment (rolls)",
      "Subfloor panels",
      "Trim / shoe moulding",
      "Baseboards (bundle)",
      "T-moulding / reducer",
      "Stair nosing",
      "Transition strips",
      "Carpet roll",
      "Carpet pad roll",
      "Thresholds",
    ],
  },
  designer: {
    label: "Interior designer",
    baseRate: 250,
    perPiece: 45,
    included: 2,
    quickAdd: [
      "Accent chair",
      "Lounge chair",
      "Console table",
      "Sideboard",
      "Artwork (framed)",
      "Mirror (large)",
      "Chandelier / pendant",
      "Floor lamp",
      "Table lamp (pair)",
      "Area rug (rolled)",
      "Throw pillows (carton)",
      "Decorative objects (boxed)",
      "Sculpture / objet",
      "Drapery panels (boxed)",
      "Bedside tables (pair)",
      "Bar cart",
      "Dining chairs (vendor pickup)",
      "Ottoman / pouf",
    ],
  },
  cabinetry: {
    label: "Cabinetry & fixtures",
    baseRate: 200,
    perPiece: 35,
    included: 3,
    quickAdd: [
      "Upper wall cabinets (flat pack)",
      "Base cabinets (flat pack)",
      "Tall pantry cabinet",
      "Island cabinet pack",
      "Vanity cabinet",
      "Countertop slab (crated)",
      "Quartz remnant crate",
      "Hardware caddy / boxes",
      "Crown moulding (bundle)",
      "Light rail / filler strips",
      "Panel ends",
      "Range hood (boxed)",
      "Farm sink (crate)",
      "Pull-out organizer kits",
      "Glass door inserts (boxed)",
      "Appliance garage kit",
      "Wine rack insert",
      "Lazy Susan (boxed)",
    ],
  },
  medical_equipment: {
    label: "Medical / lab",
    baseRate: 350,
    perPiece: 55,
    included: 2,
    quickAdd: [
      "Exam table",
      "Procedure chair",
      "Patient monitor (cart)",
      "Ultrasound unit",
      "ECG machine",
      "Autoclave (small)",
      "Lab refrigerator",
      "Centrifuge",
      "Microscope (case)",
      "Dental chair",
      "X-ray portable unit",
      "Sterilizer cabinet",
      "Supply cart",
      "IV pole (set)",
      "Cabinet / casework",
      "Waiting room seating",
      "Desk / workstation",
      "File / records cabinet",
    ],
  },
  appliance: {
    label: "Appliance delivery",
    baseRate: 175,
    perPiece: 40,
    included: 2,
    quickAdd: [
      "Full-size refrigerator",
      "French-door refrigerator",
      "Upright freezer",
      "Chest freezer",
      "Front-load washer",
      "Front-load dryer",
      "Laundry pair (2 units)",
      "Electric range",
      "Gas range",
      "Wall oven (boxed)",
      "Cooktop",
      "OTR microwave",
      "Built-in microwave",
      "Dishwasher",
      "Panel-ready dishwasher",
      "Wine cooler",
      "Beverage centre",
    ],
  },
  art_gallery: {
    label: "Art & gallery",
    baseRate: 300,
    perPiece: 50,
    included: 2,
    quickAdd: [
      "Framed painting (medium)",
      "Framed painting (large)",
      "Canvas (unframed, rolled)",
      "Sculpture (pedestal)",
      "Sculpture (crated)",
      "Glass display case",
      "Pedestal / plinth",
      "Track lighting fixture",
      "Sculpture vitrine",
      "Print portfolio (flat)",
      "Mirror (antique)",
      "Multi-panel work (crated)",
      "Installation hardware kit",
      "Climate monitor (boxed)",
    ],
  },
  restaurant_hospitality: {
    label: "Restaurant / hospitality",
    baseRate: 200,
    perPiece: 28,
    included: 4,
    quickAdd: [
      "Dining table (4-top)",
      "Dining table (6-top)",
      "Booth seating section",
      "Bar stool (each)",
      "High-top table",
      "POS terminal / stand",
      "Kitchen shelving unit",
      "Reach-in cooler (doors off)",
      "Prep table (stainless)",
      "Ice machine (floor model)",
      "Espresso machine",
      "Draft tower (boxed)",
      "Outdoor heater",
      "Host stand",
      "Chairs (stack, set)",
      "Banquet chairs (cart)",
      "Sound bar / AV shelf",
      "Signage (boxed)",
    ],
  },
  office_furniture: {
    label: "Office / commercial",
    baseRate: 175,
    perPiece: 25,
    included: 5,
    quickAdd: [
      "Executive desk",
      "Standing desk",
      "Desk return / bridge",
      "Task chair",
      "Guest chair (each)",
      "Conference table",
      "Meeting chairs (set)",
      "Filing cabinet (lateral)",
      "Filing cabinet (vertical)",
      "Bookcase",
      "Storage credenza",
      "Monitor arm (boxed)",
      "Dual monitors (boxed)",
      "Whiteboard (large)",
      "Printer / MFP",
      "Server rack (partial)",
      "Cubicle panels (bundle)",
    ],
  },
  ecommerce_bulk: {
    label: "E-commerce / bulk",
    baseRate: 125,
    perPiece: 12,
    included: 8,
    quickAdd: [
      "Skid / pallet (stacked)",
      "Gaylord (full)",
      "Bulk carton (L)",
      "Bulk carton (XL)",
      "Flat-pack furniture box",
      "Equipment crate",
      "Display fixture (knockdown)",
      "POS kiosk (boxed)",
      "Rolling rack",
      "Parcel sack (bulk)",
      "Tote bins (stack)",
      "Hazmat-cleared parcel",
      "Oversize parcel",
      "Multi-piece order (consolidated)",
    ],
  },
  custom: {
    label: "Custom / other",
    baseRate: 175,
    perPiece: 30,
    included: 3,
    quickAdd: [
      "Equipment crate",
      "Palletized freight",
      "Oversize item",
      "Fragile (boxed)",
      "Multi-carton order",
      "White-glove item",
      "Threshold delivery",
      "Room-of-choice item",
    ],
  },
};

/** Admin dropdown + map: canonical B2B vertical codes with labels. */
export const ADMIN_VERTICAL_OPTIONS: { value: string; label: string }[] = [
  { value: "furniture_retail", label: VERTICAL_CONFIG.furniture_retail.label },
  { value: "flooring", label: VERTICAL_CONFIG.flooring.label },
  { value: "designer", label: VERTICAL_CONFIG.designer.label },
  { value: "cabinetry", label: VERTICAL_CONFIG.cabinetry.label },
  { value: "medical_equipment", label: VERTICAL_CONFIG.medical_equipment.label },
  { value: "appliance", label: VERTICAL_CONFIG.appliance.label },
  { value: "art_gallery", label: VERTICAL_CONFIG.art_gallery.label },
  { value: "restaurant_hospitality", label: VERTICAL_CONFIG.restaurant_hospitality.label },
  { value: "office_furniture", label: VERTICAL_CONFIG.office_furniture.label },
  { value: "ecommerce_bulk", label: VERTICAL_CONFIG.ecommerce_bulk.label },
];

/**
 * Map `organizations.vertical` / legacy `type` to a `delivery_verticals.code`
 * used by VERTICAL_CONFIG and loadB2BVerticalPricing.
 */
export function mapOrgVerticalToDeliveryVerticalCode(
  orgVertical: string | null | undefined,
): string {
  const v = (orgVertical || "").trim().toLowerCase();
  const table: Record<string, string> = {
    furniture_retailer: "furniture_retail",
    retail: "furniture_retail",
    interior_designer: "designer",
    designer: "designer",
    cabinetry: "cabinetry",
    flooring: "flooring",
    art_gallery: "art_gallery",
    antique_dealer: "art_gallery",
    hospitality: "restaurant_hospitality",
    developer: "office_furniture",
    medical_equipment: "medical_equipment",
    av_technology: "office_furniture",
    appliances: "appliance",
    appliance: "appliance",
    hvac: "custom",
    ecommerce: "ecommerce_bulk",
    office: "office_furniture",
    restaurant: "restaurant_hospitality",
  };
  if (table[v]) return table[v];
  /** Portfolio & referral CRM verticals don't map to catalog furniture rows; use dimensional "custom". */
  if (
    v === "property_management_residential" ||
    v === "property_management_commercial" ||
    v === "developer_builder" ||
    v === "realtor" ||
    v === "property_manager"
  ) {
    return "custom";
  }
  if (v in VERTICAL_CONFIG) return v;
  return "custom";
}

/**
 * Ensure the preferred catalog code exists among active verticals before defaulting UI.
 */
export function clampToActiveDeliveryVerticalCode(
  preferred: string | null | undefined,
  /** Codes in `delivery_verticals.sort_order` sequence */
  activeCodesOrdered: readonly string[],
): string {
  const ordered = [...activeCodesOrdered].filter(Boolean);
  if (ordered.length === 0) return "";
  const p = typeof preferred === "string" ? preferred.trim() : "";
  if (p && ordered.includes(p)) return p;
  if (ordered.includes("custom")) return "custom";
  return ordered[0] ?? "";
}
