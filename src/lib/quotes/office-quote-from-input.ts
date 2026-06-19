/**
 * Assembles the office tier quote in the exact shape the quotes table + the
 * downstream consumers expect (TierResult: price/deposit/tax/total/includes),
 * from an inventory list + context. Used by /api/quotes/generate so office
 * mirrors the residential tiers JSONB, while the engine math stays in
 * office-quote-engine.ts.
 */

import {
  estimateOfficeLabour,
  type OfficeInventoryLine,
} from "@/lib/quotes/office-inventory-labour";
import {
  calcOfficeTiers,
  type OfficeQuoteContext,
  type OfficeQuoteConfig,
} from "@/lib/quotes/office-quote-engine";
import { officeTierIncludes } from "@/lib/quotes/office-tier-quote-display";
import { OFFICE_TIER_ORDER, type OfficeTierKey } from "@/lib/tiers/office-tier-definitions";

export interface OfficeTierResultShape {
  price: number;
  deposit: number;
  tax: number;
  total: number;
  includes: string[];
}

export interface OfficeTierQuote {
  tiers: Record<OfficeTierKey, OfficeTierResultShape>;
  /** Recommended (Priority) tier, surfaced as the single-price fallback. */
  recommended: OfficeTierResultShape;
  factors: Record<string, unknown>;
}

export function buildOfficeTierQuote(
  inventory: OfficeInventoryLine[],
  ctx: OfficeQuoteContext = {},
  config: OfficeQuoteConfig = {},
): OfficeTierQuote {
  const labour = estimateOfficeLabour(inventory);
  const result = calcOfficeTiers(labour, ctx, config);

  const tiers = {} as Record<OfficeTierKey, OfficeTierResultShape>;
  for (const tier of OFFICE_TIER_ORDER) {
    const tp = result.tiers[tier];
    tiers[tier] = {
      price: tp.price,
      deposit: tp.deposit,
      tax: tp.tax,
      total: tp.total,
      includes: officeTierIncludes(tier, { crew: tp.crew, trucks: tp.trucks }),
    };
  }

  const factors = {
    ...result.factors,
    // Persist the raw inventory so the move + quote display can rebuild scope
    // without re-deriving it (and so a re-quote is reproducible).
    office_inventory: inventory,
    office_confidence_reason: result.confidence.reason,
    office_per_tier_breakdown: {
      essential: result.tiers.essential.breakdown,
      signature: result.tiers.signature.breakdown,
      priority: result.tiers.priority.breakdown,
    },
  };

  return { tiers, recommended: tiers.priority, factors };
}
