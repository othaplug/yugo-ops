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

/** Straight-line km from Yugo HQ (GTA core) to each stop; used for out-of-core surcharges. */
export interface BinHubDistanceInput {
  delivery_km_from_hub: number | null;
  pickup_km_from_hub: number | null;
  /** True when Mapbox geocoding failed for one or both addresses */
  distance_pricing_unavailable?: boolean;
}

export interface BinRentalDistanceCharge {
  deliveryDistanceKm: number;
  pickupDistanceKm: number;
  deliveryDriveMinutes: number;
  pickupDriveMinutes: number;
  deliveryFee: number;
  pickupFee: number;
  totalDistanceFee: number;
}

/** Toronto reference (GTA core) for hub distance; matches mapbox/driving-distance GTA_CORE. */
export const YUGO_HQ_LAT = 43.6534817;
export const YUGO_HQ_LNG = -79.3839347;

export function haversineKmBin(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rough regional drive time from straight-line km from hub (GTA logistics). */
export function estimateBinRegionalDriveMinutes(distanceKm: number): number {
  if (distanceKm <= 20) return 30;
  if (distanceKm <= 50) return Math.round(30 + (distanceKm - 20) * 1.2);
  if (distanceKm <= 100) return Math.round(66 + (distanceKm - 50) * 0.9);
  return Math.round(111 + (distanceKm - 100) * 0.7);
}

/**
 * Per-leg fee beyond free radius: max(extraKm * rate, min fee), rounded to nearest $5.
 */
export function calculateBinDistanceFeeFromKm(
  deliveryKm: number | null,
  pickupKm: number | null,
  config: Map<string, string>,
): BinRentalDistanceCharge | null {
  if (
    deliveryKm == null ||
    pickupKm == null ||
    !Number.isFinite(deliveryKm) ||
    !Number.isFinite(pickupKm)
  ) {
    return null;
  }

  const freeRadius = cfgNum(config, "bin_rental_free_radius_km", 20);
  const perKm = cfgNum(config, "bin_rental_per_km", 3.5);
  const minFee = cfgNum(config, "bin_rental_min_distance_fee", 50);

  const feeForLeg = (km: number): number => {
    if (km <= freeRadius) return 0;
    const extraKm = km - freeRadius;
    let raw = Math.max(Math.round(extraKm * perKm), minFee);
    raw = Math.round(raw / 5) * 5;
    return raw;
  };

  const deliveryFee = feeForLeg(deliveryKm);
  const pickupFee = feeForLeg(pickupKm);

  return {
    deliveryDistanceKm: Math.round(deliveryKm * 10) / 10,
    pickupDistanceKm: Math.round(pickupKm * 10) / 10,
    deliveryDriveMinutes: estimateBinRegionalDriveMinutes(deliveryKm),
    pickupDriveMinutes: estimateBinRegionalDriveMinutes(pickupKm),
    deliveryFee,
    pickupFee,
    totalDistanceFee: deliveryFee + pickupFee,
  }
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
  /** Optional hub distances (km) for delivery and pickup stops */
  hub_distance?: BinHubDistanceInput;
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
      distanceCharge: BinRentalDistanceCharge | null;
      distancePricingUnavailable: boolean;
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

  let distanceCharge: BinRentalDistanceCharge | null = null;
  const distIn = input.hub_distance;
  const distUnavailable = !!distIn?.distance_pricing_unavailable;
  if (!distUnavailable && distIn) {
    distanceCharge = calculateBinDistanceFeeFromKm(
      distIn.delivery_km_from_hub,
      distIn.pickup_km_from_hub,
      config,
    );
    if (distanceCharge && distanceCharge.totalDistanceFee > 0) {
      if (distanceCharge.deliveryFee > 0) {
        subtotal += distanceCharge.deliveryFee;
        lines.push({
          key: "distance_delivery",
          label: `Delivery distance fee (${distanceCharge.deliveryDistanceKm} km)`,
          amount: distanceCharge.deliveryFee,
        });
      }
      if (distanceCharge.pickupFee > 0) {
        subtotal += distanceCharge.pickupFee;
        lines.push({
          key: "distance_pickup",
          label: `Pickup distance fee (${distanceCharge.pickupDistanceKm} km)`,
          amount: distanceCharge.pickupFee,
        });
      }
    }
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
    distanceCharge,
    distancePricingUnavailable: distUnavailable,
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
