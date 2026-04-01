import type { B2BQuoteLineItem } from "@/lib/pricing/b2b-dimensional";
import { fallbackB2bItemConfig } from "@/lib/b2b-default-item-config";

export type B2bBundleRules = {
  freeAccessories?: string[];
  freeWith?: Record<string, string[]>;
  freeRatio?: number;
  includedQuantity?: number;
  perPieceAfter?: number;
  perUnitAfter?: number;
};

export type B2bItemConfigShape = {
  label?: string;
  quickAdd?: { name: string; weight?: string; fragile?: boolean; unit?: string; icon?: string }[];
  showFields?: string[];
  bundleRules?: B2bBundleRules;
};

export function parseBundleRulesFromItemConfig(itemConfig: unknown): B2bBundleRules | null {
  if (!itemConfig || typeof itemConfig !== "object" || Array.isArray(itemConfig)) return null;
  const br = (itemConfig as Record<string, unknown>).bundleRules;
  if (!br || typeof br !== "object" || Array.isArray(br)) return null;
  const o = br as Record<string, unknown>;
  const freeAccessories = Array.isArray(o.freeAccessories)
    ? o.freeAccessories.filter((x): x is string => typeof x === "string")
    : undefined;
  let freeWith: Record<string, string[]> | undefined;
  if (o.freeWith && typeof o.freeWith === "object" && !Array.isArray(o.freeWith)) {
    const fw: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(o.freeWith as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const parents = v.filter((x): x is string => typeof x === "string");
        if (parents.length) fw[k] = parents;
      }
    }
    if (Object.keys(fw).length) freeWith = fw;
  }
  const freeRatio = typeof o.freeRatio === "number" && Number.isFinite(o.freeRatio) ? o.freeRatio : undefined;
  const includedQuantity =
    typeof o.includedQuantity === "number" && Number.isFinite(o.includedQuantity) ? o.includedQuantity : undefined;
  const perPieceAfter =
    typeof o.perPieceAfter === "number" && Number.isFinite(o.perPieceAfter) ? o.perPieceAfter : undefined;
  const perUnitAfter =
    typeof o.perUnitAfter === "number" && Number.isFinite(o.perUnitAfter) ? o.perUnitAfter : undefined;
  if (
    !freeAccessories?.length &&
    !freeWith &&
    includedQuantity == null &&
    perPieceAfter == null &&
    perUnitAfter == null
  ) {
    return null;
  }
  return {
    freeAccessories,
    freeWith,
    freeRatio,
    includedQuantity,
    perPieceAfter,
    perUnitAfter,
  };
}

export function parseB2bItemConfigShape(
  defaultConfig: Record<string, unknown> | null | undefined,
): B2bItemConfigShape | null {
  if (!defaultConfig || typeof defaultConfig !== "object") return null;
  const ic = defaultConfig.item_config;
  if (!ic || typeof ic !== "object" || Array.isArray(ic)) return null;
  return ic as B2bItemConfigShape;
}

/** DB `item_config` plus code fallbacks when `quickAdd` or whole `item_config` is missing. */
export function resolveB2bItemConfig(
  defaultConfig: Record<string, unknown> | null | undefined,
  verticalCode: string,
): B2bItemConfigShape | null {
  const base = parseB2bItemConfigShape(defaultConfig);
  const fb = fallbackB2bItemConfig(verticalCode);
  if (!base && fb) return fb as B2bItemConfigShape;
  if (base && (!base.quickAdd || base.quickAdd.length === 0) && fb?.quickAdd?.length) {
    return {
      ...base,
      quickAdd: fb.quickAdd as B2bItemConfigShape["quickAdd"],
      label: base.label || fb.label,
    };
  }
  return base;
}

/**
 * Marks free accessories and free-with-parent units as `bundled` so tiered base pricing ignores them.
 * Each `freeWith` child description gets its own allowance: sum(parent qty for that child's parent list) × freeRatio.
 * Multiple lines of the same child type draw from one pool (in input order).
 */
export function applyBundleRulesToLineItems(
  items: B2BQuoteLineItem[],
  rules: B2bBundleRules | null,
): B2BQuoteLineItem[] {
  if (!rules || items.length === 0) return items.map((i) => ({ ...i }));

  const freeAcc = new Set((rules.freeAccessories ?? []).map((s) => s.trim()).filter(Boolean));
  const freeWith = rules.freeWith ?? {};
  const ratio = rules.freeRatio != null && rules.freeRatio > 0 ? rules.freeRatio : 1;

  const qtyByDesc = new Map<string, number>();
  for (const i of items) {
    const d = i.description.trim();
    if (!d) continue;
    qtyByDesc.set(d, (qtyByDesc.get(d) ?? 0) + Math.max(1, i.quantity));
  }

  /** Remaining free units per child SKU (matches launch spec: each accessory type vs its parents). */
  const pools = new Map<string, number>();
  for (const [childDesc, parentList] of Object.entries(freeWith)) {
    const k = childDesc.trim();
    if (!k || !Array.isArray(parentList) || parentList.length === 0) continue;
    const parentQty = parentList.reduce((sum, p) => sum + (qtyByDesc.get(p.trim()) ?? 0), 0);
    pools.set(k, parentQty * ratio);
  }

  const out: B2BQuoteLineItem[] = [];
  for (const item of items) {
    const desc = item.description.trim();
    const q = Math.max(1, item.quantity);
    if (!desc) continue;

    if (freeAcc.has(desc)) {
      out.push({ ...item, quantity: q, bundled: true });
      continue;
    }

    const parents = freeWith[desc];
    if (parents && parents.length > 0) {
      const parentQty = parents.reduce((sum, p) => sum + (qtyByDesc.get(p.trim()) ?? 0), 0);
      if (parentQty <= 0) {
        out.push({ ...item, quantity: q, bundled: false });
        continue;
      }
      let pool = pools.get(desc) ?? 0;
      const take = Math.min(q, pool);
      pools.set(desc, pool - take);
      const paid = q - take;
      if (take > 0) out.push({ ...item, quantity: take, bundled: true });
      if (paid > 0) out.push({ ...item, quantity: paid, bundled: false });
      continue;
    }

    out.push({ ...item, quantity: q, bundled: item.bundled });
  }
  return out;
}

export function mergeBundleTierIntoMergedRates(merged: Record<string, unknown>): Record<string, unknown> {
  const rules = parseBundleRulesFromItemConfig(merged.item_config);
  const next = { ...merged };
  if (rules?.includedQuantity != null && Number.isFinite(rules.includedQuantity)) {
    next.items_included_in_base = rules.includedQuantity;
  }
  const per = rules?.perPieceAfter ?? rules?.perUnitAfter;
  if (per != null && Number.isFinite(Number(per))) {
    next.per_item_rate_after_base = Number(per);
  }
  return next;
}
