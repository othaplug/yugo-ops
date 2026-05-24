/**
 * Canonical tier definitions — single source of truth for ops flags, pricing fallbacks,
 * and tier identity. Every part of the app that needs to know what a tier includes reads
 * from here.
 *
 * Tier philosophy:
 *   Essential  = Access        → "I prepared everything. Move it properly."
 *   Signature  = Assurance     → "Everything is protected. Nothing exposed."
 *   Estate     = Delegation    → "Everything is handled. I don't need to be involved."
 *
 * NOTE: pricing.multiplier is the CODE-LEVEL FALLBACK only.
 * The live multiplier is stored in platform_config (tier_essential_multiplier etc.)
 * and is editable from Admin → Pricing Settings. platform_config always wins.
 */

export type TierKey = "essential" | "signature" | "estate";

export interface TierDefinition {
  key: TierKey;
  name: string;
  tagline: string;
  clientDescription: string;
  bestFor: string;

  /** Operational flags — used by pricing engine, crew app, and admin scope panels. */
  ops: {
    includesAssembly: boolean;         // false on Essential — assembly is an add-on
    includesFullWrap: boolean;         // false on Essential — only wrappedItemLimit items
    wrappedItemLimit: number | null;   // null = unlimited
    includesRoomOfChoice: boolean;     // false on Essential — entry point only
    includesMattressBag: boolean;
    includesTVBag: boolean;
    includesWardrobeBox: boolean;
    includesDebrisRemoval: boolean;
    includesFloorProtection: boolean;  // always true — operational standard
    includesCoordinator: boolean;
    includesPreMoveWalkthrough: boolean;
    includesFullPacking: boolean;
    includesFullUnpacking: boolean;
    includesSpecialtyHandling: boolean;
    includesInventoryDocumentation: boolean;
    includesPostMoveConcierge: boolean;
    includesCircleAccess: boolean;
    namedDirector: boolean;
    crewMinimum: number;
  };

  /**
   * Code-level pricing fallbacks.
   * The live multiplier is read from platform_config by the generate route.
   * depositPct is also overridable via platform_config (deposit_*_pct keys).
   */
  pricing: {
    /** cfgNum fallback for tier_*_multiplier in platform_config */
    multiplier: number;
    /** cfgNum fallback for deposit_*_pct in platform_config (as whole number: 10 = 10%) */
    depositPct: number;
  };
}

export const TIER_DEFINITIONS: Record<TierKey, TierDefinition> = {
  essential: {
    key: "essential",
    name: "Essential",
    tagline: "Precision, without the extras.",
    clientDescription:
      "A clean, reliable move for clients who are organized and ready to go.",
    bestFor: "Organized, prepared moves with minimal handling needs.",

    ops: {
      includesAssembly: false,
      includesFullWrap: false,
      wrappedItemLimit: 3,
      includesRoomOfChoice: false,
      includesMattressBag: false,
      includesTVBag: false,
      includesWardrobeBox: false,
      includesDebrisRemoval: false,
      includesFloorProtection: true,
      includesCoordinator: false,
      includesPreMoveWalkthrough: false,
      includesFullPacking: false,
      includesFullUnpacking: false,
      includesSpecialtyHandling: false,
      includesInventoryDocumentation: false,
      includesPostMoveConcierge: false,
      includesCircleAccess: false,
      namedDirector: false,
      crewMinimum: 2,
    },

    pricing: {
      multiplier: 1.0,
      depositPct: 10,
    },
  },

  signature: {
    key: "signature",
    name: "Signature",
    tagline: "Everything protected. Nothing exposed.",
    clientDescription:
      "The move done properly — every item wrapped, every detail handled, nothing left to manage.",
    bestFor: "Full-home moves where protection, flow, and peace of mind matter.",

    ops: {
      includesAssembly: true,
      includesFullWrap: true,
      wrappedItemLimit: null,
      includesRoomOfChoice: true,
      includesMattressBag: true,
      includesTVBag: true,
      includesWardrobeBox: true,
      includesDebrisRemoval: true,
      includesFloorProtection: true,
      includesCoordinator: true,
      includesPreMoveWalkthrough: false,
      includesFullPacking: false,
      includesFullUnpacking: false,
      includesSpecialtyHandling: false,
      includesInventoryDocumentation: false,
      includesPostMoveConcierge: false,
      includesCircleAccess: false,
      namedDirector: false,
      crewMinimum: 2,
    },

    pricing: {
      multiplier: 1.52,
      depositPct: 15,
    },
  },

  estate: {
    key: "estate",
    name: "Estate",
    tagline: "A fully managed home transition.",
    clientDescription:
      "Every detail handled before you arrive. Your move director owns this from first call to final placement.",
    bestFor:
      "Clients who expect every detail handled — high-value homes, art, antiques, complete transitions.",

    ops: {
      includesAssembly: true,
      includesFullWrap: true,
      wrappedItemLimit: null,
      includesRoomOfChoice: true,
      includesMattressBag: true,
      includesTVBag: true,
      includesWardrobeBox: true,
      includesDebrisRemoval: true,
      includesFloorProtection: true,
      includesCoordinator: true,
      includesPreMoveWalkthrough: true,
      includesFullPacking: true,
      includesFullUnpacking: true,
      includesSpecialtyHandling: true,
      includesInventoryDocumentation: true,
      includesPostMoveConcierge: true,
      includesCircleAccess: true,
      namedDirector: true,
      crewMinimum: 3,
    },

    pricing: {
      multiplier: 3.35,
      depositPct: 25,
    },
  },
};

/** Get the ops flags for a tier. */
export function getTierOps(tier: TierKey): TierDefinition["ops"] {
  return TIER_DEFINITIONS[tier].ops;
}

/** Check if a specific ops feature is included in a tier. */
export function tierIncludes(
  tier: TierKey,
  feature: keyof TierDefinition["ops"],
): boolean {
  return !!TIER_DEFINITIONS[tier].ops[feature];
}

/** Normalize any string to a TierKey, defaulting to 'essential'. */
export function normalizeTierKey(t: string | null | undefined): TierKey {
  const k = (t ?? "essential").toLowerCase().trim();
  if (k === "signature" || k === "estate") return k;
  return "essential";
}
