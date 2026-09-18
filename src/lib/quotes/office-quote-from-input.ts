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
  /** Recommended (Signature) tier, surfaced as the single-price fallback. */
  recommended: OfficeTierResultShape;
  factors: Record<string, unknown>;
}

export function buildOfficeTierQuote(
  inventory: OfficeInventoryLine[],
  ctx: OfficeQuoteContext = {},
  config: OfficeQuoteConfig = {},
  /**
   * Pre-tax add-on dollars to add on top of each tier's base price (already net
   * of any per-tier exclusion). Office quotes DO offer add-ons (IT
   * disconnect/reconnect, workstation labeling, COI processing, shredding,
   * etc.) — previously these were computed but never billed on office.
   */
  addonByTier: Partial<Record<OfficeTierKey, number>> = {},
): OfficeTierQuote {
  const labour = estimateOfficeLabour(inventory);
  const result = calcOfficeTiers(labour, ctx, config);
  const taxRate = config.taxRate ?? 0.13;
  const depositPct = config.depositPct ?? 30;

  const tiers = {} as Record<OfficeTierKey, OfficeTierResultShape>;
  let addonTotalApplied = 0;
  for (const tier of OFFICE_TIER_ORDER) {
    const tp = result.tiers[tier];
    const addon = Math.max(0, Math.round(addonByTier[tier] ?? 0));
    const price = tp.price + addon;
    if (addon > 0) addonTotalApplied = Math.max(addonTotalApplied, addon);
    tiers[tier] =
      addon > 0
        ? {
            price,
            tax: Math.round(price * taxRate),
            total: price + Math.round(price * taxRate),
            deposit: Math.round(price * (depositPct / 100)),
            includes: officeTierIncludes(tier, { crew: tp.crew, trucks: tp.trucks }),
          }
        : {
            price: tp.price,
            deposit: tp.deposit,
            tax: tp.tax,
            total: tp.total,
            includes: officeTierIncludes(tier, { crew: tp.crew, trucks: tp.trucks }),
          };
  }

  const factors = {
    ...result.factors,
    office_addon_total: addonTotalApplied,
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

  return { tiers, recommended: tiers.signature, factors };
}
