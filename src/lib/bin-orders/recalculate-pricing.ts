import {
  BIN_RENTAL_BUNDLE_SPECS,
  calculateBinRentalPrice,
  type BinBundleKey,
} from "@/lib/pricing/bin-rental";
import { cfgNum } from "@/lib/pricing/engine";

const VALID_DB_BUNDLES = new Set([
  "individual",
  "studio",
  "1br",
  "2br",
  "3br",
  "4br_plus",
]);

export type BinOrderRow = {
  move_id?: string | null;
  includes_paper?: boolean | null;
  bin_count?: number | null;
};

/**
 * Maps bin_orders.bundle_type to pricing input. DB uses "individual"; pricing uses "custom".
 */
export const dbBundleToPricingKey = (db: string): BinBundleKey | null => {
  if (!VALID_DB_BUNDLES.has(db)) return null;
  return db === "individual" ? "custom" : (db as BinBundleKey);
};

export function recalculateBinOrderPricing(
  order: BinOrderRow,
  nextBundleType: string,
  nextBinCount: number | undefined,
  config: Map<string, string>,
):
  | {
      ok: true;
      bundle_type: string;
      bin_count: number;
      bundle_price: number;
      delivery_surcharge: number;
      subtotal: number;
      hst: number;
      total: number;
    }
  | { ok: false; error: string } {
  const pricingKey = dbBundleToPricingKey(nextBundleType);
  if (!pricingKey) return { ok: false, error: "Invalid bundle type" };

  const rawCustomBins = nextBinCount ?? Number(order.bin_count) ?? 5;
  let binCountForCustom = Math.max(
    5,
    Math.floor(Number.isFinite(rawCustomBins) ? rawCustomBins : 5),
  );

  if (pricingKey !== "custom") {
    binCountForCustom = BIN_RENTAL_BUNDLE_SPECS[pricingKey].bins;
  }

  const priceResult = calculateBinRentalPrice(
    {
      bundle_type: pricingKey,
      bin_count: pricingKey === "custom" ? binCountForCustom : undefined,
      extra_bins: 0,
      packing_paper: !!order.includes_paper,
      material_delivery_charge: !order.move_id,
      linked_move_id: order.move_id ?? null,
      available_bins: null,
    },
    config,
  );

  if (!priceResult.ok) {
    return { ok: false, error: priceResult.error };
  }

  const deliverySur = priceResult.lines
    .filter((l) => l.key === "material_delivery")
    .reduce((s, l) => s + l.amount, 0);

  const bundle_price = Math.round((priceResult.subtotal - deliverySur) * 100) / 100;
  const subtotal = priceResult.subtotal;
  const taxRate = cfgNum(config, "tax_rate", 0.13);
  const hst = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + hst) * 100) / 100;

  return {
    ok: true,
    bundle_type: nextBundleType,
    bin_count: priceResult.totalBins,
    bundle_price,
    delivery_surcharge: deliverySur,
    subtotal,
    hst,
    total,
  };
}
