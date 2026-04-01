/**
 * Fallback `item_config` when DB `default_config.item_config` is missing or has no quickAdd.
 * Keeps coordinators productive before migrations or after partial config saves.
 */

type QuickPreset = { name: string; weight?: string; fragile?: boolean; unit?: string; icon?: string };

export type FallbackItemConfig = {
  label?: string;
  quickAdd: QuickPreset[];
  showFields?: string[];
};

const CUSTOM: FallbackItemConfig = {
  label: "Items",
  quickAdd: [{ name: "Custom item", weight: "medium" }],
  showFields: ["description", "quantity", "weight", "fragile"],
};

const BY_CODE: Record<string, FallbackItemConfig> = {
  furniture_retail: {
    label: "Furniture Items",
    quickAdd: [
      { name: "Sofa / Sectional", weight: "heavy", icon: "Armchair" },
      { name: "Dining Table", weight: "heavy", icon: "Table" },
      { name: "Dining Chairs", weight: "light", icon: "Chair" },
      { name: "Bed Frame", weight: "heavy", icon: "Bed" },
      { name: "Dresser", weight: "heavy", icon: "Dresser" },
      { name: "Coffee Table", weight: "medium", icon: "Table" },
      { name: "Custom item", weight: "medium", icon: "Package" },
    ],
    showFields: ["description", "quantity", "weight", "fragile"],
  },
  flooring: {
    label: "Flooring Materials",
    quickAdd: [
      { name: "Hardwood boxes", weight: "heavy", unit: "box" },
      { name: "Laminate boxes", weight: "medium", unit: "box" },
      { name: "Tile boxes", weight: "heavy", unit: "box" },
      { name: "Carpet rolls", weight: "heavy", unit: "roll" },
      { name: "Custom item", weight: "medium", unit: "unit" },
    ],
    showFields: ["description", "quantity", "weight", "unit_type"],
  },
  designer: {
    label: "Design Project Items",
    quickAdd: [
      { name: "Sofa / Sectional", weight: "heavy" },
      { name: "Accent Chair", weight: "medium" },
      { name: "Area Rug", weight: "medium" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight", "fragile", "stop_assignment"],
  },
  cabinetry: {
    label: "Cabinetry & Fixtures",
    quickAdd: [
      { name: "Upper cabinet", weight: "heavy" },
      { name: "Lower / base cabinet", weight: "extra_heavy" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight", "fragile"],
  },
  medical_equipment: {
    label: "Medical Equipment",
    quickAdd: [
      { name: "Exam table", weight: "extra_heavy" },
      { name: "Monitor / display", weight: "medium", fragile: true },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight", "fragile", "serial_number"],
  },
  appliance: {
    label: "Appliances",
    quickAdd: [
      { name: "Refrigerator", weight: "extra_heavy" },
      { name: "Washer", weight: "extra_heavy" },
      { name: "Dryer", weight: "extra_heavy" },
      { name: "Custom item", weight: "heavy" },
    ],
    showFields: ["description", "quantity", "weight", "hookup_required", "haul_away_old"],
  },
  art_gallery: {
    label: "Art & Gallery Pieces",
    quickAdd: [
      { name: "Painting (medium 24-48\")", weight: "medium", fragile: true },
      { name: "Sculpture", weight: "heavy", fragile: true },
      { name: "Custom item", weight: "medium", fragile: true },
    ],
    showFields: ["description", "quantity", "weight", "fragile", "crating_required", "declared_value"],
  },
  restaurant_hospitality: {
    label: "Restaurant & Hospitality",
    quickAdd: [
      { name: "Table", weight: "heavy" },
      { name: "Chair", weight: "light" },
      { name: "Bar stool", weight: "light" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight", "fragile"],
  },
  office_furniture: {
    label: "Office Furniture",
    quickAdd: [
      { name: "Desk", weight: "heavy" },
      { name: "Office chair", weight: "medium" },
      { name: "Conference table", weight: "extra_heavy" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight", "assembly_required"],
  },
  ecommerce_bulk: {
    label: "E-Commerce Parcels",
    quickAdd: [
      { name: "Small parcel", weight: "light" },
      { name: "Medium parcel", weight: "medium" },
      { name: "Large parcel", weight: "heavy" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight"],
  },
  ecommerce: {
    label: "E-Commerce Parcels",
    quickAdd: [
      { name: "Small parcel", weight: "light" },
      { name: "Medium parcel", weight: "medium" },
      { name: "Large parcel", weight: "heavy" },
      { name: "Custom item", weight: "medium" },
    ],
    showFields: ["description", "quantity", "weight"],
  },
  custom: CUSTOM,
};

export function fallbackB2bItemConfig(verticalCode: string): FallbackItemConfig | null {
  const c = verticalCode.trim().toLowerCase();
  return BY_CODE[c] ?? null;
}
