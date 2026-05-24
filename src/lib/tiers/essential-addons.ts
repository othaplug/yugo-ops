/**
 * Essential tier add-ons.
 *
 * These services are not included in Essential and become purchasable add-ons
 * when Essential is selected. They bridge the gap between Essential and Signature
 * for clients who need a specific extra without upgrading the full tier.
 *
 * Each item here should also exist in the `addons` DB table with
 * excluded_tiers: ['signature', 'estate'] so they flow through the standard
 * quote generation path and remain admin-manageable.
 */

export interface EssentialAddon {
  key: string;
  label: string;
  description: string;
  priceLabel: string;
  price: number;
  pricingType: "flat" | "per_item" | "per_unit" | "bundle";
  /** Shown to coordinator: context on what Signature includes instead. */
  upgradeNote: string;
}

export const ESSENTIAL_ADDONS: EssentialAddon[] = [
  {
    key: "assembly_single",
    label: "Furniture assembly / disassembly",
    description: "Per item — beds, desks, wardrobes, and standard furniture.",
    priceLabel: "$85 per item",
    price: 85,
    pricingType: "per_item",
    upgradeNote: "Included in Signature — unlimited items",
  },
  {
    key: "assembly_bundle",
    label: "Assembly bundle",
    description: "Disassembly and reassembly for up to 3 items.",
    priceLabel: "$199",
    price: 199,
    pricingType: "bundle",
    upgradeNote: "Included in Signature — unlimited items",
  },
  {
    key: "extra_wrap",
    label: "Additional wrapped items",
    description:
      "Beyond the 3 items included. Each additional piece wrapped in quilted blankets.",
    priceLabel: "$15 per item",
    price: 15,
    pricingType: "per_item",
    upgradeNote: "Included in Signature — all items wrapped",
  },
  {
    key: "full_wrap_upgrade",
    label: "Full wrap upgrade",
    description: "Every piece of furniture wrapped. No item left unprotected.",
    priceLabel: "$75 flat",
    price: 75,
    pricingType: "flat",
    upgradeNote: "Included in Signature",
  },
  {
    key: "mattress_bag",
    label: "Mattress protection bag",
    description: "Sealed plastic protection for each mattress.",
    priceLabel: "$13 per mattress",
    price: 13,
    pricingType: "per_item",
    upgradeNote: "Included in Signature",
  },
  {
    key: "tv_protection",
    label: "TV protection bag",
    description: "Padded protection for flat-screen televisions.",
    priceLabel: "$15 per TV",
    price: 15,
    pricingType: "per_item",
    upgradeNote: "Included in Signature",
  },
  {
    key: "room_of_choice",
    label: "Room-of-choice placement",
    description: "Crew places every item exactly where you want it.",
    priceLabel: "$75 flat",
    price: 75,
    pricingType: "flat",
    upgradeNote: "Included in Signature",
  },
  {
    key: "wardrobe_box",
    label: "Wardrobe boxes",
    description: "Tall boxes for hanging clothes. Returned after your move.",
    priceLabel: "$20 per box",
    price: 20,
    pricingType: "per_unit",
    upgradeNote: "Included in Signature",
  },
  {
    key: "debris_removal",
    label: "Debris and packaging removal",
    description:
      "All packing materials removed and disposed of after your move.",
    priceLabel: "$45 flat",
    price: 45,
    pricingType: "flat",
    upgradeNote: "Included in Signature",
  },
];
