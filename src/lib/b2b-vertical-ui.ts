/**
 * Product-level B2B Jobs form visibility (by delivery vertical code).
 * Intersects with `delivery_verticals.default_config.field_visibility` via callers.
 */

export type B2bQuickAddPreset = {
  name: string;
  weight: "light" | "medium" | "heavy" | "extra_heavy";
  fragile?: boolean;
  unit?: string;
  icon?: string;
};

/** Normalize aliases to canonical DB codes used in delivery_verticals. */
export function normalizeB2bVerticalFormCode(code: string): string {
  const c = code.trim().toLowerCase();
  if (c === "medical") return "medical_equipment";
  if (c === "interior_designer") return "designer";
  return c;
}

/** Complexity / extras field keys (matches form + b2b-jobs-field-visibility). */
const COMPLEXITY_BY_VERTICAL: Record<string, string[]> = {
  furniture_retail: ["debris_removal", "high_value", "stairs"],
  flooring: ["debris_removal", "skid_count", "total_load_weight", "stairs"],
  designer: ["debris_removal", "high_value", "artwork", "antiques", "stairs"],
  cabinetry: ["debris_removal", "stairs"],
  medical_equipment: ["chain_of_custody", "high_value", "stairs"],
  medical: ["chain_of_custody", "high_value", "stairs"],
  appliance: ["hookup_install", "haul_away", "stairs"],
  art_gallery: ["high_value", "artwork", "stairs"],
  restaurant_hospitality: ["debris_removal", "stairs"],
  office_furniture: ["debris_removal", "stairs"],
  ecommerce: ["returns_pickup", "same_day"],
  ecommerce_bulk: ["returns_pickup", "same_day"],
  custom: ["debris_removal", "high_value", "artwork", "antiques", "stairs"],
};

/** Per line-item sub-field keys (matches LineRow + showItemField). */
const LINE_FIELDS_BY_VERTICAL: Record<string, string[]> = {
  furniture_retail: ["description", "qty", "weight", "fragile", "assembly_required"],
  flooring: ["description", "qty", "weight", "unit_type"],
  designer: ["description", "qty", "weight", "fragile", "stop_assignment"],
  medical_equipment: ["description", "qty", "weight", "fragile", "serial_number", "declared_value"],
  medical: ["description", "qty", "weight", "fragile", "serial_number", "declared_value"],
  appliance: ["description", "qty", "weight", "hookup_required", "haul_away_old"],
  art_gallery: ["description", "qty", "weight", "fragile", "crating_required", "declared_value"],
  restaurant_hospitality: ["description", "qty", "weight", "fragile"],
  office_furniture: ["description", "qty", "weight", "assembly_required"],
  ecommerce: ["description", "qty", "weight"],
  ecommerce_bulk: ["description", "qty", "weight"],
  cabinetry: ["description", "qty", "weight", "fragile"],
  custom: ["description", "qty", "weight", "fragile"],
};

export function b2bVerticalComplexityKeys(verticalCode: string): string[] {
  const n = normalizeB2bVerticalFormCode(verticalCode);
  return COMPLEXITY_BY_VERTICAL[n] ?? COMPLEXITY_BY_VERTICAL.custom ?? [];
}

export function b2bVerticalLineFieldKeys(verticalCode: string): string[] {
  const n = normalizeB2bVerticalFormCode(verticalCode);
  return LINE_FIELDS_BY_VERTICAL[n] ?? LINE_FIELDS_BY_VERTICAL.custom ?? [];
}

/** True if this vertical should show the per-item key (e.g. `weight`, `unit_type`). */
export function b2bVerticalShowsLineField(verticalCode: string, fieldKey: string): boolean {
  const keys = b2bVerticalLineFieldKeys(verticalCode);
  return keys.includes(fieldKey);
}

/**
 * Maps product-level keys to `b2bJobsFieldVisible` keys.
 * `hookup_install` → `hookup`, `returns_pickup` → `returns`, `total_load_weight` → `total_weight`
 */
export function b2bComplexityVisibilityKey(key: string): string {
  if (key === "hookup_install") return "hookup";
  if (key === "returns_pickup") return "returns";
  if (key === "total_load_weight") return "total_weight";
  return key;
}

export const B2B_VERTICAL_QUICK_ADD: Record<string, B2bQuickAddPreset[]> = {
  furniture_retail: [
    { name: "Sofa / Sectional", weight: "heavy", icon: "Armchair" },
    { name: "Dining Table", weight: "heavy", icon: "Table" },
    { name: "Dining Chair", weight: "light", icon: "Chair" },
    { name: "Bed Frame", weight: "heavy", icon: "Bed" },
    { name: "Mattress", weight: "heavy" },
    { name: "Dresser", weight: "heavy", icon: "Dresser" },
    { name: "Coffee Table", weight: "medium", icon: "Table" },
    { name: "Bookshelf", weight: "medium" },
    { name: "Ottoman", weight: "medium" },
    { name: "Accent Chair", weight: "medium", icon: "Chair" },
    { name: "Console Table", weight: "medium" },
    { name: "Desk", weight: "heavy" },
  ],
  flooring: [
    { name: "Hardwood boxes", weight: "heavy", unit: "box" },
    { name: "Laminate boxes", weight: "medium", unit: "box" },
    { name: "Vinyl plank boxes", weight: "medium", unit: "box" },
    { name: "Tile boxes", weight: "heavy", unit: "box" },
    { name: "Vinyl rolls", weight: "heavy", unit: "roll" },
    { name: "Carpet rolls", weight: "heavy", unit: "roll" },
    { name: "Underlayment", weight: "light", unit: "roll" },
    { name: "T-moulds", weight: "light" },
    { name: "Reducers", weight: "light" },
    { name: "Trim / nosing", weight: "light" },
  ],
  designer: [
    { name: "Sofa / Sectional", weight: "heavy" },
    { name: "Accent Chair", weight: "medium" },
    { name: "Ottoman", weight: "medium" },
    { name: "Coffee Table", weight: "medium" },
    { name: "Side Table", weight: "light" },
    { name: "Area Rug", weight: "medium" },
    { name: "Artwork / Frame", weight: "light", fragile: true },
    { name: "Mirror", weight: "medium", fragile: true },
    { name: "Lamp / Lighting", weight: "light", fragile: true },
    { name: "Television", weight: "medium" },
    { name: "Console", weight: "medium" },
    { name: "Dining Table", weight: "heavy" },
  ],
  cabinetry: [
    { name: "Upper cabinet", weight: "heavy" },
    { name: "Lower / base cabinet", weight: "extra_heavy" },
    { name: "Vanity", weight: "heavy" },
    { name: "Countertop slab", weight: "extra_heavy" },
  ],
  medical_equipment: [
    { name: "Exam table", weight: "extra_heavy" },
    { name: "Imaging unit", weight: "extra_heavy" },
    { name: "Monitor / display", weight: "medium", fragile: true },
    { name: "Dental chair", weight: "heavy" },
  ],
  appliance: [
    { name: "Refrigerator", weight: "extra_heavy" },
    { name: "Washer", weight: "extra_heavy" },
    { name: "Dryer", weight: "extra_heavy" },
    { name: "Range / oven", weight: "extra_heavy" },
    { name: "Dishwasher", weight: "heavy" },
    { name: "Microwave (OTR)", weight: "medium" },
  ],
  art_gallery: [
    { name: "Framed piece (small)", weight: "light", fragile: true },
    { name: "Framed piece (medium)", weight: "medium", fragile: true },
    { name: "Sculpture", weight: "heavy", fragile: true },
    { name: "Glass display", weight: "heavy", fragile: true },
  ],
  restaurant_hospitality: [
    { name: "Dining Table", weight: "heavy" },
    { name: "Chair", weight: "light" },
    { name: "Bar stool", weight: "light" },
    { name: "Booth section", weight: "heavy" },
    { name: "Commercial oven", weight: "extra_heavy" },
    { name: "Prep station", weight: "heavy" },
  ],
  office_furniture: [
    { name: "Desk", weight: "heavy" },
    { name: "Office chair", weight: "medium" },
    { name: "File cabinet", weight: "heavy" },
    { name: "Conference table", weight: "extra_heavy" },
  ],
  ecommerce: [
    { name: "Small parcel", weight: "light" },
    { name: "Medium parcel", weight: "medium" },
    { name: "Large parcel", weight: "heavy" },
    { name: "Pallet", weight: "extra_heavy" },
  ],
  ecommerce_bulk: [
    { name: "Small parcel", weight: "light" },
    { name: "Medium parcel", weight: "medium" },
    { name: "Large parcel", weight: "heavy" },
    { name: "Pallet", weight: "extra_heavy" },
  ],
  custom: [
    { name: "Custom item", weight: "medium" },
  ],
};

export function b2bVerticalQuickAddPresets(verticalCode: string): B2bQuickAddPreset[] {
  const n = normalizeB2bVerticalFormCode(verticalCode);
  return B2B_VERTICAL_QUICK_ADD[n] ?? B2B_VERTICAL_QUICK_ADD.custom ?? [];
}
