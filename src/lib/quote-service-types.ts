/**
 * Coordinator Generate Quote — service type metadata (no React).
 */
export type QuoteServiceTypeDefinition = {
  value: string;
  label: string;
  description: string;
  /** Residential-style tier packages */
  hasTiers: boolean;
  /** Inventory / box-count step */
  hasInventory: boolean;
};

export const QUOTE_SERVICE_TYPE_DEFINITIONS: readonly QuoteServiceTypeDefinition[] = [
  {
    value: "local_move",
    label: "Residential (Local)",
    description: "Local home move with tier packages",
    hasTiers: true,
    hasInventory: true,
  },
  {
    value: "long_distance",
    label: "Long Distance",
    description: "Inter-city or provincial home move with tier packages",
    hasTiers: true,
    hasInventory: true,
  },
  {
    value: "office_move",
    label: "Office",
    description: "Business, retail, salon, clinic relocation",
    hasTiers: false,
    hasInventory: true,
  },
  {
    value: "single_item",
    label: "Single Item",
    description: "One item or small batch delivery",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "white_glove",
    label: "White Glove",
    description: "Premium item-based handling, assembly, placement",
    hasTiers: false,
    hasInventory: true,
  },
  {
    value: "specialty",
    label: "Specialty",
    description: "Piano, art, antiques, complex items",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "event",
    label: "Event",
    description: "Round-trip venue delivery & teardown",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "b2b_delivery",
    label: "B2B One-Off",
    description: "One-off delivery from a business",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "labour_only",
    label: "Labour Only",
    description: "Crew work at one location, no transit",
    hasTiers: false,
    hasInventory: false,
  },
  {
    value: "bin_rental",
    label: "Bin Rental",
    description: "Eco-friendly plastic bin rental",
    hasTiers: false,
    hasInventory: false,
  },
] as const;

/** Returns true only for service types that use Essential / Signature / Estate tier packages. */
export function serviceTypeHasTiers(serviceType: string | null | undefined): boolean {
  const v = typeof serviceType === "string" ? serviceType.trim() : "";
  const def = QUOTE_SERVICE_TYPE_DEFINITIONS.find((d) => d.value === v);
  // local_move and long_distance are the only tiered service types.
  return def?.hasTiers ?? false;
}

/** The set of service types that use tier-based pricing, for guards and DB writes. */
export const TIERED_SERVICE_TYPES = new Set(
  QUOTE_SERVICE_TYPE_DEFINITIONS.filter((d) => d.hasTiers).map((d) => d.value),
);
