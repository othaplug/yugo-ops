/**
 * Plastic bin rental pricing for coordinator quotes (service_type bin_rental).
 * Config keys: bin_bundle_*, bin_individual_price, bin_packing_paper_fee, bin_delivery_charge, bin_total_inventory.
 * Legacy fallbacks: bin_rental_* keys where applicable.
 */

export type BinBundleKey = "studio" | "1br" | "2br" | "3br" | "4br_plus" | "custom";

export interface BinRentalBundleSpec {
  bins: number;
  wardrobeBoxes: number;
  label: string;
}

export const BIN_RENTAL_BUNDLE_SPECS: Record<Exclude<BinBundleKey, "custom">, BinRentalBundleSpec> = {
  studio: { bins: 15, wardrobeBoxes: 2, label: "Studio" },
  "1br": { bins: 30, wardrobeBoxes: 4, label: "1 Bedroom" },
  "2br": { bins: 50, wardrobeBoxes: 6, label: "2 Bedroom" },
  "3br": { bins: 70, wardrobeBoxes: 8, label: "3 Bedroom" },
  "4br_plus": { bins: 90, wardrobeBoxes: 10, label: "4 Bedroom+" },
};

function cfgNum(config: Map<string, string>, key: string, fallback: number): number {
  const v = config.get(key);
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function totalBinsForBundle(bundleType: BinBundleKey, customBinCount: number): number {
  if (bundleType === "custom") return Math.max(0, Math.floor(customBinCount));
  const spec = BIN_RENTAL_BUNDLE_SPECS[bundleType];
  return spec?.bins ?? 0;
}

export function wardrobeBoxesForBundle(bundleType: BinBundleKey): number {
  if (bundleType === "custom") return 0;
  return BIN_RENTAL_BUNDLE_SPECS[bundleType]?.wardrobeBoxes ?? 0;
}

export interface BinRentalPriceInput {
  bundle_type: BinBundleKey;
  /** When bundle_type === custom */
  bin_count?: number;
  extra_bins?: number;
  packing_paper?: boolean;
  /** When true, add material delivery charge (unless linked_move_id) */
  material_delivery_charge?: boolean;
  linked_move_id?: string | null;
  /** Bins available after subtracting fleet out on rental; if set and totalBins exceeds this, returns error */
  available_bins?: number | null;
}

export interface BinRentalLineItem {
  key: string;
  label: string;
  amount: number;
}

export type BinRentalPriceOutcome =
  | {
      ok: true;
      subtotal: number;
      lines: BinRentalLineItem[];
      totalBins: number;
      wardrobeBoxes: number;
      bundleLabel: string;
    }
  | { ok: false; error: string; availableBins?: number; requiredBins?: number };

/**
 * Returns subtotal before tax. Caller applies HST.
 */
export function calculateBinRentalPrice(
  input: BinRentalPriceInput,
  config: Map<string, string>,
): BinRentalPriceOutcome {
  const perBin = cfgNum(config, "bin_individual_price", cfgNum(config, "bin_rental_individual_price", 6));

  const bundlePrices: Record<Exclude<BinBundleKey, "custom">, number> = {
    studio: cfgNum(config, "bin_bundle_studio", 99),
    "1br": cfgNum(config, "bin_bundle_1br", 179),
    "2br": cfgNum(config, "bin_bundle_2br", 279),
    "3br": cfgNum(config, "bin_bundle_3br", 399),
    "4br_plus": cfgNum(config, "bin_bundle_4br_plus", 529),
  };

  let bundleLabel = "Custom";
  let subtotal = 0;
  const lines: BinRentalLineItem[] = [];
  let totalBins = 0;
  let wardrobeBoxes = 0;

  if (input.bundle_type === "custom") {
    const n = Math.max(0, Math.floor(input.bin_count ?? 0));
    if (n < 5) {
      return { ok: false, error: "Custom bin orders require at least 5 bins." };
    }
    totalBins = n;
    subtotal = n * perBin;
    bundleLabel = "Custom";
    lines.push({
      key: "custom_bins",
      label: `${n} bins × ${formatMoney(perBin)}`,
      amount: subtotal,
    });
  } else {
    const spec = BIN_RENTAL_BUNDLE_SPECS[input.bundle_type];
    wardrobeBoxes = spec.wardrobeBoxes;
    totalBins = spec.bins;
    const price = bundlePrices[input.bundle_type] ?? 0;
    subtotal = price;
    bundleLabel = `${spec.label} bundle`;
    lines.push({
      key: "bundle",
      label: `${spec.label} bundle`,
      amount: price,
    });
  }

  const extra = Math.max(0, Math.floor(input.extra_bins ?? 0));
  if (extra > 0) {
    const exCost = extra * perBin;
    subtotal += exCost;
    lines.push({
      key: "extra_bins",
      label: `Extra bins (${extra} × ${formatMoney(perBin)})`,
      amount: exCost,
    });
    totalBins += extra;
  }

  const packingCfg = cfgNum(config, "bin_packing_paper_fee", 20);
  if (input.packing_paper) {
    subtotal += packingCfg;
    lines.push({ key: "packing_paper", label: "Packing paper", amount: packingCfg });
  }

  const deliveryFee = cfgNum(config, "bin_delivery_charge", cfgNum(config, "bin_rental_delivery_surcharge_gta", 20));
  const linked = !!(input.linked_move_id && String(input.linked_move_id).trim());
  const wantDelivery = input.material_delivery_charge !== false;
  if (wantDelivery && !linked) {
    subtotal += deliveryFee;
    lines.push({
      key: "material_delivery",
      label: "Material delivery",
      amount: deliveryFee,
    });
  }

  const avail = input.available_bins;
  if (avail != null && Number.isFinite(avail) && avail >= 0 && totalBins > avail) {
    return {
      ok: false,
      error: `Only ${Math.floor(avail)} bins available. This quote needs ${totalBins} bins.`,
      availableBins: Math.floor(avail),
      requiredBins: totalBins,
    };
  }

  return {
    ok: true,
    subtotal,
    lines,
    totalBins,
    wardrobeBoxes,
    bundleLabel,
  };
}

function formatMoney(n: number): string {
  return `$${n}`;
}

/** Sum bins on active rental orders (Supabase admin/service client). */
export async function sumBinsOutOnRental(sb: { from: (t: string) => unknown }): Promise<number> {
  const activeStatuses = [
    "confirmed",
    "drop_off_scheduled",
    "bins_delivered",
    "in_use",
    "pickup_scheduled",
    "overdue",
  ];
  const chain = sb.from("bin_orders") as {
    select: (cols: string) => { in: (col: string, vals: string[]) => Promise<{ data: unknown }> };
  };
  const { data } = await chain.select("bin_count").in("status", activeStatuses);
  const rows = (data ?? []) as { bin_count: number | null }[];
  return rows.reduce((s, r) => s + (Number(r.bin_count) || 0), 0);
}

export function availableBinInventory(totalInventory: number, outOnRental: number): number {
  return Math.max(0, Math.floor(totalInventory) - Math.max(0, Math.floor(outOnRental)));
}
