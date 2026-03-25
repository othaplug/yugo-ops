/**
 * Coordinator Generate Quote — service type metadata (no React).
 * Icons are Phosphor names; map to components in QuoteFormClient.
 */
export type QuoteServicePhosphorIcon =
  | "House"
  | "Buildings"
  | "Package"
  | "Star"
  | "Palette"
  | "CalendarBlank"
  | "Truck"
  | "Users"
  | "Recycle";

export type QuoteServiceTypeDefinition = {
  value: string;
  label: string;
  description: string;
  iconName: QuoteServicePhosphorIcon;
  /** Residential-style tier packages */
  hasTiers: boolean;
  /** Inventory / box-count step */
  hasInventory: boolean;
};

export const QUOTE_SERVICE_TYPE_DEFINITIONS: readonly QuoteServiceTypeDefinition[] = [
  {
    value: "local_move",
    label: "Residential",
    description: "Local or long distance home move",
    iconName: "House",
    hasTiers: true,
    hasInventory: true,
  },
  {
    value: "office_move",
    label: "Office",
    description: "Business, retail, salon, clinic relocation",
    iconName: "Buildings",
    hasTiers: true,
    hasInventory: true,
  },
  {
    value: "single_item",
    label: "Single Item",
    description: "One item or small batch delivery",
    iconName: "Package",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "white_glove",
    label: "White Glove",
    description: "Premium handling, assembly, placement",
    iconName: "Star",
    hasTiers: true,
    hasInventory: true,
  },
  {
    value: "specialty",
    label: "Specialty",
    description: "Piano, art, antiques, complex items",
    iconName: "Palette",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "event",
    label: "Event",
    description: "Round-trip venue delivery & teardown",
    iconName: "CalendarBlank",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "b2b_delivery",
    label: "B2B One-Off",
    description: "One-off delivery from a business",
    iconName: "Truck",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "labour_only",
    label: "Labour Only",
    description: "Crew work at one location, no transit",
    iconName: "Users",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "bin_rental",
    label: "Bin Rental",
    description: "Eco-friendly plastic bin rental",
    iconName: "Recycle",
    hasTiers: false,
    hasInventory: false,
  },
] as const;
