import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";
import {
  applyBundleRulesToLineItems,
  mergeBundleTierIntoMergedRates,
  parseBundleRulesFromItemConfig,
} from "@/lib/b2b-bundle-line-items";

/** Flooring unit type drives per-line handling tier (Mapbox / coordinator line items). */
export function flooringHandlingTypeFromUnitType(unitType: string | undefined): string | undefined {
  const u = (unitType || "").trim().toLowerCase();
  if (!u) return undefined;
  if (u === "pallet") return "skid_drop";
  if (u === "roll" || u === "piece") return "carry_in";
  if (u === "box" || u === "bundle" || u === "bag" || u === "unit") return "hand_bomb";
  return undefined;
}

export function prepareB2bLineItemsForDimensionalEngine(
  items: B2BQuoteLineItem[],
  verticalCode: string,
  quoteHandlingType: string,
  mergedRates: Record<string, unknown>,
): B2BQuoteLineItem[] {
  const v = verticalCode.trim().toLowerCase();
  const ht0 = (quoteHandlingType || "threshold").trim().toLowerCase();

  const withHandling = items.map((i) => {
    let line = { ...i };
    if (v === "flooring") {
      const uht = flooringHandlingTypeFromUnitType(i.unit_type);
      if (uht) {
        line = { ...line, handling_type: uht };
      } else if (!line.handling_type) {
        line = { ...line, handling_type: ht0 };
      }
      if ((i.unit_type || "").trim().toLowerCase() === "pallet") {
        line = { ...line, is_skid: true };
      }
    } else if (!line.handling_type) {
      line = { ...line, handling_type: ht0 };
    }
    return line;
  });

  const rules = parseBundleRulesFromItemConfig(mergedRates.item_config);
  return applyBundleRulesToLineItems(withHandling, rules ?? null);
}

export function mergedRatesWithBundleTiers(mergedRates: Record<string, unknown>): Record<string, unknown> {
  return mergeBundleTierIntoMergedRates(mergedRates);
}
