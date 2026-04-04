import type { Addon } from "@/app/quote/[quoteId]/quote-shared";

/**
 * Slugs bundled into Estate (not sold as add-ons). DB uses slugs from `addons.slug`.
 * Aliases cover legacy / spec names (e.g. packing_materials_kit).
 */
const ESTATE_INCLUDED_SLUGS = [
  "packing_materials",
  "packing_materials_kit",
  "packing_materials_premium",
  "full_packing",
  "full_packing_service",
  "unpacking",
  "unpacking_service",
  "mattress_bag",
  "extra_assembly",
  "furniture_assembly",
  "floor_protection",
] as const;

function slugHiddenForEstate(slug: string): boolean {
  return (ESTATE_INCLUDED_SLUGS as readonly string[]).includes(slug);
}

/** Add-ons shown for the selected / recommended residential tier. */
export function getVisibleAddons(allAddons: Addon[], recommendedTier: string | null | undefined): Addon[] {
  const tier = (recommendedTier || "essential").toLowerCase();
  return allAddons.filter((a) => {
    if (a.excluded_tiers?.includes(tier)) return false;
    if (tier === "estate") {
      if (slugHiddenForEstate(a.slug)) return false;
      return true;
    }
    return true;
  });
}

export function isAddonHiddenForTier(slug: string, tier: string): boolean {
  const t = tier.toLowerCase();
  if (t === "estate") return slugHiddenForEstate(slug);
  return false;
}

export const ESTATE_ADDON_SECTION_PREAMBLE = {
  title: "Estate includes",
  body:
    "Full packing and unpacking, premium materials, five wardrobe boxes, mattress bags, complete furniture assembly, floor protection, and full replacement valuation.",
  sub: "Additional services (not included in Estate)",
} as const;

/** UI heading lines (admin + client add-on section) */
export const ESTATE_ADDON_UI_LINES = [
  "Estate includes",
  "Full packing + unpacking, premium materials, 5 wardrobe boxes, mattress bags, complete furniture assembly, floor protection, full replacement valuation.",
  "Additional services (not included in Estate)",
] as const;
