/**
 * Add-on pricing, single source of truth.
 *
 * Historically this lived inline in `src/app/api/quotes/generate/route.ts` and
 * baked add-ons into the tier price at generation. But a client can also add
 * add-ons on the quote page AFTER generation (persisted to
 * `quotes.selected_addons` at booking). Those never went through the engine, so
 * the move was created at the bare tier price and every client-added add-on went
 * uncharged (see MV-30378: $912 of add-ons billed as $0). Move creation now
 * re-prices `selected_addons` through THIS function so the contract, balance and
 * balance auto-charge all include them.
 *
 * Keep this the only place that prices add-ons. `generate/route.ts` imports it.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  STORAGE_ADDON_SLUG,
  storageWeeklyRate,
  clampStorageWeeks,
} from "@/lib/quotes/storage-pricing";
import { effectiveExcludedTiers } from "@/lib/quotes/addon-visibility";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface AddonSelection {
  addon_id: string;
  /** Denormalized slug the client picker persists alongside addon_id; handy for
   *  analytics and logging. Pricing always resolves by addon_id, not slug. */
  slug?: string;
  quantity?: number;
  tier_index?: number;
  /**
   * Variant-matrix selection (currently only TV wall mounting). Presence
   * of this field routes the engine through the variant_matrix branch.
   * Multiple selections may share addon_id — one per TV in the household.
   */
  variant?: {
    size: string;
    type: string;
  };
  /** Plural form the client picker persists (one row per TV). Priced by summing
   *  each variant cell; falls back to the singular `variant` above. */
  variants?: Array<{
    size?: string;
    type?: string;
    inches?: number;
    quantity?: number;
  }>;
}

export interface AddonBreakdownItem {
  addon_id: string;
  slug: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  /**
   * Human-readable specifics for this line so every surface (admin move detail,
   * client tracking page, booking alert, confirmation email) can say exactly
   * WHAT was selected: how many bins, which TV size/mount. Formatted once here
   * so the surfaces never drift. "We almost got in trouble for not knowing what
   * add-ons were added" — this closes that.
   */
  detail?: string;
  /** Preserved on variant_matrix rows so the client display can label the line. */
  variant?: {
    size: string;
    type: string;
    mount_model?: string;
  };
  /** Multiple TVs on one variant_matrix add-on: the full priced list. */
  variants?: Array<{
    size: string;
    type: string;
    mount_model?: string;
    quantity: number;
  }>;
}

export interface AddonPriceResult {
  total: number;
  breakdown: AddonBreakdownItem[];
  byTierExclusion: Map<string, number>;
}

export async function calculateAddons(
  sb: SupabaseAdmin,
  selections: AddonSelection[] | undefined,
  baseTotal: number,
  moveSize?: string | null,
  serviceType?: string | null,
): Promise<AddonPriceResult> {
  if (!selections || selections.length === 0) {
    return { total: 0, breakdown: [], byTierExclusion: new Map() };
  }

  const addonIds = selections.map((s) => s.addon_id);
  const { data: addons } = await sb.from("addons").select("*").in("id", addonIds);
  const addonMap = new Map<string, Record<string, unknown>>();
  for (const a of addons ?? []) addonMap.set(a.id, a);

  let total = 0;
  const breakdown: AddonBreakdownItem[] = [];
  const byTierExclusion = new Map<string, number>();

  for (const sel of selections) {
    const addon = addonMap.get(sel.addon_id);
    if (!addon) continue;

    let cost = 0;
    const qty = sel.quantity || 1;
    let detail: string | undefined;
    let variantOut: AddonBreakdownItem["variant"] | undefined;
    let variantsOut:
      | Array<{ size: string; type: string; mount_model?: string; quantity: number }>
      | undefined;

    switch (addon.price_type as string) {
      case "flat":
        cost = (addon.price as number);
        break;
      case "per_unit":
        // Secure storage is billed per week at a size-based rate; quantity is
        // the number of weeks (clamped 1–STORAGE_MAX_WEEKS). The DB price is a
        // placeholder — storageWeeklyRate(moveSize) is the source of truth.
        if ((addon.slug as string) === STORAGE_ADDON_SLUG) {
          cost = storageWeeklyRate(moveSize, serviceType) * clampStorageWeeks(qty);
        } else {
          cost = (addon.price as number) * qty;
        }
        break;
      case "tiered": {
        const tiers = addon.tiers as
          | { label?: string; price: number; bins?: number; bundle?: string }[]
          | null;
        const t = tiers?.[sel.tier_index ?? 0];
        cost = t?.price ?? 0;
        // e.g. "1 Bedroom (30 bins)" or "30 bins" — so the crew and admin know
        // exactly how many bins / which bundle the client chose.
        detail = t?.label ?? (t?.bins != null ? `${t.bins} bins` : undefined);
        break;
      }
      case "percent":
        cost = Math.round(baseTotal * ((addon.percent_value as number) ?? 0));
        break;
      case "variant_matrix": {
        // Look up variant_config.sizes[size].types[type].price × qty and SUM
        // across every selected variant. The client picker persists a plural
        // `variants[]` array (one row per TV); a singular `variant{}` is also
        // accepted for the legacy/expanded shape. Reading only `variant` here
        // meant a real client selection (stored as variants[]) priced to $0 and
        // was never charged (see MV-30378). Both shapes now price correctly.
        const cfg = addon.variant_config as
          | { sizes?: Record<string, { label?: string; types?: Record<string, { price?: number; mount_model?: string }> }> }
          | null;
        const variantRows: Array<{ size?: string; type?: string; quantity?: number }> =
          Array.isArray(sel.variants) && sel.variants.length > 0
            ? sel.variants
            : sel.variant
              ? [{ size: sel.variant.size, type: sel.variant.type, quantity: qty }]
              : [];
        const pricedVariants: Array<{ size: string; type: string; mount_model?: string; quantity: number }> = [];
        for (const v of variantRows) {
          const size = v.size;
          const type = v.type;
          const cell = size && type ? cfg?.sizes?.[size]?.types?.[type] : null;
          if (cell && typeof cell.price === "number" && size && type) {
            const vq = Math.max(1, Math.round(Number(v.quantity ?? 1)) || 1);
            cost += cell.price * vq;
            pricedVariants.push({ size, type, mount_model: cell.mount_model, quantity: vq });
          }
        }
        if (pricedVariants.length === 1) {
          variantOut = {
            size: pricedVariants[0].size,
            type: pricedVariants[0].type,
            mount_model: pricedVariants[0].mount_model,
          };
        } else if (pricedVariants.length > 1) {
          // Multiple TVs: keep the full list on the breakdown for display.
          variantsOut = pricedVariants;
        }
        // e.g. "56-65\" full motion (Kanto LDX640)" — one clause per TV so admin
        // and crew know the exact size, mount type and bracket model to bring.
        if (pricedVariants.length > 0) {
          detail = pricedVariants
            .map((v) => {
              // The stored size label is a range like `56" – 65"` (en dash);
              // brand rule forbids en/em dashes, and a size range reads as a
              // hyphen, so normalize the range dash to a hyphen (never a comma,
              // which would look like two separate sizes).
              const sizeLabel = (cfg?.sizes?.[v.size]?.label ?? v.size).replace(
                /\s*[—–]\s*/g,
                "-",
              );
              return (
                `${sizeLabel} ${String(v.type).replace(/_/g, " ")}` +
                (v.mount_model ? ` (${v.mount_model})` : "") +
                (v.quantity > 1 ? ` x${v.quantity}` : "")
              );
            })
            .join(", ");
        }
        break;
      }
    }

    total += cost;
    breakdown.push({
      addon_id: addon.id as string,
      slug: addon.slug as string,
      name: addon.name as string,
      price: cost,
      quantity: qty,
      subtotal: cost,
      ...(detail ? { detail } : {}),
      ...(variantOut ? { variant: variantOut } : {}),
      ...(variantsOut ? { variants: variantsOut } : {}),
    });

    // Per-tier exclusion via the single source of truth (DB excluded_tiers +
    // the code-side Estate-included list), so a tier that already includes this
    // service is never charged for it (fixes the Estate/Signature double-charge).
    const excluded = effectiveExcludedTiers(
      addon.slug as string,
      addon.excluded_tiers as string[] | null,
    );
    for (const tier of excluded) {
      byTierExclusion.set(tier, (byTierExclusion.get(tier) ?? 0) + cost);
    }
  }

  return { total, breakdown, byTierExclusion };
}

/** Tier keys that mean the same commercial tier (schema drift over time). */
const TIER_EXCLUSION_ALIASES: Record<string, string[]> = {
  essential: ["essential", "curated", "essentials"],
  signature: ["signature", "premier"],
  estate: ["estate"],
};

/**
 * The add-on dollars that apply to ONE tier: the full add-on total minus
 * anything that tier already includes for free. This is the exact amount the
 * engine layers onto that tier's base price at generation (addonForCur/Sig/Est),
 * so move creation can re-derive it for the locked tier without drift.
 */
export function addonAmountForTier(
  result: AddonPriceResult,
  tierKey: string | null | undefined,
): number {
  if (!tierKey) return result.total;
  const aliases = TIER_EXCLUSION_ALIASES[tierKey] ?? [tierKey];
  let excluded = 0;
  for (const a of aliases) {
    const v = result.byTierExclusion.get(a);
    if (v != null) {
      excluded = v;
      break;
    }
  }
  return Math.max(0, result.total - excluded);
}
