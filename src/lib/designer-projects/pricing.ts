import type { ProjectVendor, ProjectInventoryItem, ProjectPriceBreakdown } from "./types";

interface PricingConfig {
  baseRate?: number;
  includedItems?: number;
  perExtraItem?: number;
  perExtraStop?: number;
  assemblyPerItem?: number;
  highValueFlatFee?: number;
}

const DEFAULTS: Required<PricingConfig> = {
  baseRate: 299,
  includedItems: 5,
  perExtraItem: 30,
  perExtraStop: 55,
  assemblyPerItem: 35,
  highValueFlatFee: 50,
};

export function calcDesignerProjectQuote(
  vendors: ProjectVendor[],
  items: ProjectInventoryItem[],
  config: PricingConfig = {},
): ProjectPriceBreakdown {
  const cfg = { ...DEFAULTS, ...config };

  const totalItems = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const totalPickupStops = vendors.length;

  // Base rate covers first stop + includedItems items
  const extraStops = Math.max(0, totalPickupStops - 1);
  const extraItems = Math.max(0, totalItems - cfg.includedItems);

  const extraItemsCharge = extraItems * cfg.perExtraItem;
  const extraStopsCharge = extraStops * cfg.perExtraStop;

  const assemblyItems = items.filter((i) => i.requires_assembly);
  const assemblyCharge = assemblyItems.reduce(
    (sum, i) => sum + (i.quantity || 1) * cfg.assemblyPerItem,
    0,
  );

  const highValueItems = items.filter((i) => i.is_high_value || (i.item_value && i.item_value > 500));
  const highValueCharge = highValueItems.length * cfg.highValueFlatFee;

  const subtotal = cfg.baseRate + extraItemsCharge + extraStopsCharge + assemblyCharge + highValueCharge;
  const hst = Math.round(subtotal * 0.13 * 100) / 100;
  const total = Math.round(subtotal * 1.13 * 100) / 100;

  return {
    baseRate: cfg.baseRate,
    extraItems: { count: extraItems, charge: extraItemsCharge },
    extraStops: { count: extraStops, charge: extraStopsCharge },
    assembly: { count: assemblyItems.length, charge: assemblyCharge },
    highValue: { count: highValueItems.length, charge: highValueCharge },
    subtotal,
    hst,
    total,
  };
}
