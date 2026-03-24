import type { SupabaseClient } from "@supabase/supabase-js";
import { cfgNum, cfgJson } from "@/lib/pricing/engine";
import { getDrivingDistance } from "@/lib/mapbox/driving-distance";

const B2B_WEIGHT_FALLBACK: Record<string, number> = {
  standard: 0,
  heavy: 50,
  very_heavy: 100,
  oversized: 175,
  oversized_fragile: 175,
};

function configMapFromRows(rows: { key: string; value: string }[] | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows || []) m.set(r.key, r.value);
  return m;
}

function distanceModifier(config: Map<string, string>, distKm: number): number {
  const distUltraShortKm = cfgNum(config, "dist_ultra_short_km", 2);
  const distShortKm = cfgNum(config, "dist_short_km", 5);
  const distBaselineKm = cfgNum(config, "dist_baseline_km", 20);
  const distMediumKm = cfgNum(config, "dist_medium_km", 40);
  const distLongKm = cfgNum(config, "dist_long_km", 60);
  const distVeryLongKm = cfgNum(config, "dist_very_long_km", 100);
  const distModUltraShort = cfgNum(config, "dist_mod_ultra_short", 0.92);
  const distModShort = cfgNum(config, "dist_mod_short", 0.95);
  const distModMedium = cfgNum(config, "dist_mod_medium", 1.08);
  const distModLong = cfgNum(config, "dist_mod_long", 1.15);
  const distModVeryLong = cfgNum(config, "dist_mod_very_long", 1.25);
  const distModExtreme = cfgNum(config, "dist_mod_extreme", 1.35);
  if (distKm <= distUltraShortKm) return distModUltraShort;
  if (distKm <= distShortKm) return distModShort;
  if (distKm <= distBaselineKm) return 1.0;
  if (distKm <= distMediumKm) return distModMedium;
  if (distKm <= distLongKm) return distModLong;
  if (distKm <= distVeryLongKm) return distModVeryLong;
  return distModExtreme;
}

function roundTo(amount: number, nearest: number): number {
  if (nearest <= 0) return Math.round(amount);
  return Math.round(amount / nearest) * nearest;
}

function weightCategoryFromLbs(lbs: number | null | undefined): string {
  if (lbs == null || Number.isNaN(lbs)) return "standard";
  if (lbs >= 500) return "oversized";
  if (lbs >= 300) return "very_heavy";
  if (lbs >= 150) return "heavy";
  return "standard";
}

export interface RissdSuggestInput {
  yugoBaseAddress?: string | null;
  deliveryAddress: string;
  /** Mapbox access key for pickup at warehouse — optional; defaults to no surcharge */
  deliveryAccess?: string | null;
  receivingInspectionTier: "standard" | "detailed";
  assemblyComplexity?: "simple" | "moderate" | "complex" | null;
  /** Days shipment may sit in storage for quote preview */
  estimatedStorageDays?: number;
  /** Override weight tier */
  b2bWeightCategory?: string | null;
  /** Optional explicit max weight from line items */
  maxItemWeightLbs?: number | null;
}

export interface RissdPriceBreakdown {
  receiving_fee: number;
  storage_fee: number;
  delivery_fee: number;
  assembly_fee: number;
  subtotal: number;
  distance_km: number | null;
  distance_modifier: number;
  weight_category: string;
  access_surcharge: number;
  free_storage_days: number;
  daily_storage_rate: number;
  breakdown_lines: { label: string; amount: number }[];
}

export async function loadPlatformConfigMap(
  admin: SupabaseClient,
): Promise<Map<string, string>> {
  const { data } = await admin.from("platform_config").select("key, value");
  return configMapFromRows(data);
}

export async function suggestRissdPricing(
  admin: SupabaseClient,
  input: RissdSuggestInput,
): Promise<RissdPriceBreakdown> {
  const config = await loadPlatformConfigMap(admin);

  const receivingStandard = cfgNum(config, "rissd_receiving_fee_standard", 50);
  const receivingDetailed = cfgNum(config, "rissd_receiving_fee_detailed", 100);
  const receivingFee =
    input.receivingInspectionTier === "standard" ? receivingStandard : receivingDetailed;

  const freeDays = cfgNum(config, "rissd_storage_free_days", 3);
  const dailyRate = cfgNum(config, "rissd_storage_daily_rate", 15);
  const storageDays = Math.max(0, Math.floor(input.estimatedStorageDays ?? 0));
  const billableStorageDays = Math.max(0, storageDays - freeDays);
  const storageFee = billableStorageDays * dailyRate;

  const asmKey =
    input.assemblyComplexity === "simple"
      ? "rissd_assembly_simple"
      : input.assemblyComplexity === "moderate"
        ? "rissd_assembly_moderate"
        : input.assemblyComplexity === "complex"
          ? "rissd_assembly_complex"
          : null;
  const assemblyFee = asmKey ? cfgNum(config, asmKey, 0) : 0;

  const baseAddress =
    input.yugoBaseAddress?.trim() ||
    config.get("yugo_base_address") ||
    "507 King Street East, Toronto, ON";

  let distKm: number | null = null;
  try {
    const leg = await getDrivingDistance(baseAddress, input.deliveryAddress);
    distKm = leg?.distance_km ?? null;
  } catch {
    distKm = null;
  }

  const baseFee = cfgNum(config, "b2b_oneoff_base", 350);
  const mod = distanceModifier(config, distKm ?? 0);

  const accessMap = cfgJson<Record<string, number>>(config, "b2b_access_surcharges", {});
  const accessKey = (k: string | undefined): string =>
    k === "no_parking_nearby" ? "no_parking" : (k ?? "");
  const toAccess = input.deliveryAccess ? (accessMap[accessKey(input.deliveryAccess)] ?? 0) : 0;

  const weightMap = { ...B2B_WEIGHT_FALLBACK, ...cfgJson<Record<string, number>>(config, "b2b_weight_surcharges", {}) };
  const weightCategory =
    input.b2bWeightCategory?.trim() ||
    weightCategoryFromLbs(input.maxItemWeightLbs ?? undefined);
  const weightSurcharge = weightMap[weightCategory] ?? 0;

  let deliveryFee = Math.round(baseFee * mod) + toAccess + weightSurcharge;
  const rounding = cfgNum(config, "rounding_nearest", 50);
  deliveryFee = roundTo(deliveryFee, rounding);
  if (deliveryFee < 200) deliveryFee = 200;

  const subtotal = receivingFee + storageFee + deliveryFee + assemblyFee;

  const lines: { label: string; amount: number }[] = [
    { label: "Receiving & inspection", amount: receivingFee },
  ];
  if (storageFee > 0) {
    lines.push({
      label: `Storage (${billableStorageDays} day${billableStorageDays === 1 ? "" : "s"} after ${freeDays} free)`,
      amount: storageFee,
    });
  }
  lines.push({ label: "Delivery (B2B-style estimate)", amount: deliveryFee });
  if (assemblyFee > 0) lines.push({ label: "Assembly", amount: assemblyFee });

  return {
    receiving_fee: receivingFee,
    storage_fee: storageFee,
    delivery_fee: deliveryFee,
    assembly_fee: assemblyFee,
    subtotal,
    distance_km: distKm,
    distance_modifier: mod,
    weight_category: weightCategory,
    access_surcharge: toAccess,
    free_storage_days: freeDays,
    daily_storage_rate: dailyRate,
    breakdown_lines: lines,
  };
}
