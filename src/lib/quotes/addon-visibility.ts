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
  /** Included in Estate — do not upsell as add-ons */
  "picture_crating",
  "plastic_bin_rental",
] as const;

function slugHiddenForEstate(slug: string): boolean {
  return (ESTATE_INCLUDED_SLUGS as readonly string[]).includes(slug);
}

/**
 * SINGLE SOURCE OF TRUTH for add-on tier exclusion. Combines the DB
 * `excluded_tiers` column with the code-side ESTATE_INCLUDED_SLUGS list, so the
 * pricing engine, the client quote page, and the admin live preview can never
 * disagree about which tiers a given add-on applies to. A tier in the returned
 * set means: this add-on is already included in that tier — do NOT charge it and
 * do NOT show it as a buyable add-on.
 */
/** Legacy tier names in the DB mapped to the canonical Essential/Signature/Estate. */
const TIER_ALIASES: Record<string, string> = {
  premier: "signature",
  curated: "essential",
  essentials: "essential",
};

export function effectiveExcludedTiers(
  slug: string,
  excludedTiers: string[] | null | undefined,
): string[] {
  const set = new Set(
    (excludedTiers ?? [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => {
        const lc = t.trim().toLowerCase();
        return TIER_ALIASES[lc] ?? lc;
      }),
  );
  // Estate bundles these services regardless of what the DB column says.
  if (slugHiddenForEstate(slug)) set.add("estate");
  return [...set];
}

/** True when `slug` is already included in `tier` (so it must not be charged). */
export function isAddonIncludedInTier(
  slug: string,
  excludedTiers: string[] | null | undefined,
  tier: string,
): boolean {
  return effectiveExcludedTiers(slug, excludedTiers).includes(
    (tier || "").toLowerCase(),
  );
}

/** Quote UI label when Estate tier (e.g. five wardrobe boxes already in package). */
export function estateAddonDisplayName(slug: string, defaultName: string): string {
  if (slug === "wardrobe_boxes") return "Extra wardrobe boxes";
  return defaultName;
}

/** Add-ons shown for the selected / recommended residential tier. */
export function getVisibleAddons(allAddons: Addon[], recommendedTier: string | null | undefined): Addon[] {
  const tier = (TIER_ALIASES[(recommendedTier || "essential").toLowerCase()] ??
    (recommendedTier || "essential").toLowerCase());
  return allAddons.filter(
    (a) => !effectiveExcludedTiers(a.slug, a.excluded_tiers).includes(tier),
  );
}

export function isAddonHiddenForTier(slug: string, tier: string): boolean {
  const t = tier.toLowerCase();
  if (t === "estate") return slugHiddenForEstate(slug);
  return false;
}

export const ESTATE_ADDON_SECTION_PREAMBLE = {
  title: "Estate includes",
  body:
    "Full packing and unpacking, premium materials, five wardrobe boxes, mattress bags, complete furniture assembly, floor protection, and verified repair or full replacement valuation — all included in your Estate Package. These optional services go beyond. Choose your additional add-ons.",
  sub: "Additional services (not included in Estate)",
} as const;

/** UI heading lines (admin + client add-on section) */
export const ESTATE_ADDON_UI_LINES = [
  "Estate includes",
  "Full packing and unpacking, premium materials, five wardrobe boxes, mattress bags, complete furniture assembly, floor protection, and verified repair or full replacement valuation — all included in your Estate Package. These optional services go beyond. Choose your additional add-ons.",
  "Additional services (not included in Estate)",
] as const;
