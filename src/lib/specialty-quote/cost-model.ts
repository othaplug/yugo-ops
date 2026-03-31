/**
 * Coordinator Specialty B2B Transport — cost build-up (labour, vehicle, fuel, equipment, zone, etc.).
 * Pure functions for admin UI and API validation.
 */

export type VehicleType = "sprinter" | "16ft" | "26ft";

export type ZoneTier = "gta_core" | "zone_2" | "zone_3" | "outside";

export const VEHICLE_BASE: Record<VehicleType, number> = {
  sprinter: 67,
  "16ft": 95,
  "26ft": 130,
};

export const EQUIPMENT_RATES: Record<string, { label: string; dollars: number }> = {
  heavy_dolly: { label: "Heavy-duty dolly", dollars: 25 },
  four_wheel_dolly: { label: "4-wheel dolly", dollars: 35 },
  straps: { label: "Straps", dollars: 15 },
  moving_boards: { label: "Moving boards", dollars: 15 },
  furniture_pads: { label: "Furniture pads", dollars: 20 },
  custom_crating: { label: "Custom crating", dollars: 50 },
};

export const ZONE_FEES: Record<ZoneTier, number> = {
  gta_core: 0,
  zone_2: 75,
  zone_3: 150,
  outside: 0,
};

export const ZONE_LABELS: Record<ZoneTier, string> = {
  gta_core: "GTA Core (under 40 km)",
  zone_2: "Zone 2 (40–80 km)",
  zone_3: "Zone 3 (80–120 km)",
  outside: "Outside (over 120 km)",
};

const LABOUR_LOADED_RATE = 28;
const FUEL_PER_KM = 0.35;
const STAIR_PER_FLIGHT = 30;
const WRAP_LARGE = 25;
const WRAP_SMALL = 10;
const PROCESSING_RATE = 0.029;
const PROCESSING_FIXED = 0.3;

export function weightSurchargeDollars(weightLbs: number): number {
  if (!Number.isFinite(weightLbs) || weightLbs < 200) return 0;
  if (weightLbs < 400) return 30;
  if (weightLbs < 800) return 60;
  return 100;
}

export function zoneTierFromDistanceKm(km: number | null | undefined): ZoneTier {
  if (km == null || !Number.isFinite(km) || km < 0) return "gta_core";
  if (km < 40) return "gta_core";
  if (km < 80) return "zone_2";
  if (km < 120) return "zone_3";
  return "outside";
}

export function suggestCrewSize(weightLbs: number): number {
  if (!Number.isFinite(weightLbs) || weightLbs < 400) return 2;
  if (weightLbs < 800) return 3;
  return 4;
}

export function suggestJobHours(input: {
  distanceKm: number;
  weightLbs: number;
  extraStops: number;
}): number {
  const km = Math.max(0, input.distanceKm || 0);
  const w = Math.max(0, input.weightLbs || 0);
  const stops = Math.max(0, input.extraStops || 0);
  let h = 2 + Math.min(3.5, km / 45) + stops * 0.5;
  if (w >= 400) h += 0.75;
  if (w >= 800) h += 1;
  return Math.round(h * 2) / 2;
}

export function processingFeeDollars(subtotalBeforeProcessing: number): number {
  const b = Math.max(0, subtotalBeforeProcessing);
  return Math.round((b * PROCESSING_RATE + PROCESSING_FIXED) * 100) / 100;
}

export type CostLineInput = {
  crewCount: number;
  jobHours: number;
  labourRatePerHr?: number;
  vehicleType: VehicleType;
  weightLbs: number;
  totalKm: number;
  equipmentKeys: string[];
  wrapLargeCount: number;
  wrapSmallCount: number;
  zoneTier: ZoneTier;
  zoneFeeOverride?: number | null;
  stairFlights: number;
};

export type CostLineDetail = { key: string; label: string; amount: number };

export function buildSpecialtyCostLines(input: CostLineInput): {
  lines: CostLineDetail[];
  subtotalBeforeProcessing: number;
  processingFee: number;
  subtotal: number;
} {
  const rate = input.labourRatePerHr ?? LABOUR_LOADED_RATE;
  const labour = Math.max(0, input.crewCount) * Math.max(0, input.jobHours) * rate;
  const vBase = VEHICLE_BASE[input.vehicleType] ?? VEHICLE_BASE.sprinter;
  const wSur = weightSurchargeDollars(input.weightLbs);
  const vehicle = vBase + wSur;
  const fuel = Math.max(0, input.totalKm) * FUEL_PER_KM;
  let equipment = 0;
  for (const k of input.equipmentKeys) {
    const row = EQUIPMENT_RATES[k];
    if (row) equipment += row.dollars;
  }
  const wrapping =
    Math.max(0, input.wrapLargeCount) * WRAP_LARGE + Math.max(0, input.wrapSmallCount) * WRAP_SMALL;
  const zoneFee =
    input.zoneFeeOverride != null && Number.isFinite(input.zoneFeeOverride)
      ? Math.max(0, input.zoneFeeOverride)
      : ZONE_FEES[input.zoneTier] ?? 0;
  const stairs = Math.max(0, input.stairFlights) * STAIR_PER_FLIGHT;

  const lines: CostLineDetail[] = [
    { key: "labour", label: "Labour (loaded rate)", amount: Math.round(labour * 100) / 100 },
    { key: "vehicle", label: "Vehicle + weight surcharge", amount: Math.round(vehicle * 100) / 100 },
    { key: "fuel", label: "Fuel / distance", amount: Math.round(fuel * 100) / 100 },
    { key: "equipment", label: "Equipment", amount: Math.round(equipment * 100) / 100 },
    { key: "wrapping", label: "Wrapping", amount: Math.round(wrapping * 100) / 100 },
    { key: "zone", label: "Zone adjustment", amount: Math.round(zoneFee * 100) / 100 },
    { key: "stairs", label: "Stairs (no elevator)", amount: Math.round(stairs * 100) / 100 },
  ];

  const subtotalBeforeProcessing = lines.reduce((s, x) => s + x.amount, 0);
  const processingFee = processingFeeDollars(subtotalBeforeProcessing);
  lines.push({ key: "processing", label: "Processing (est.)", amount: processingFee });

  const subtotal = Math.round((subtotalBeforeProcessing + processingFee) * 100) / 100;

  return { lines, subtotalBeforeProcessing, processingFee, subtotal };
}

/** Keys coordinators may override in the builder; processing is always recomputed from these lines. */
export const SPECIALTY_COST_LINE_OVERRIDE_KEYS = new Set([
  "labour",
  "vehicle",
  "fuel",
  "equipment",
  "wrapping",
  "zone",
  "stairs",
]);

/**
 * Apply per-line $ overrides for non-processing rows; recompute processing fee from the adjusted subtotal.
 */
export function mergeSpecialtyNonProcessingOverrides(
  built: ReturnType<typeof buildSpecialtyCostLines>,
  overrides: Record<string, number> | null | undefined,
): { lines: CostLineDetail[]; subtotal: number; subtotal_model: number } {
  const procTemplate = built.lines.find((l) => l.key === "processing");
  if (!procTemplate) {
    return { lines: built.lines, subtotal: built.subtotal, subtotal_model: built.subtotal };
  }

  const nonProc = built.lines.filter((l) => l.key !== "processing");
  const mergedNonProc = nonProc.map((l) => {
    const o = overrides?.[l.key];
    if (o != null && Number.isFinite(o) && o >= 0) {
      return { ...l, amount: Math.round(o * 100) / 100 };
    }
    return l;
  });
  const subBefore = Math.round(mergedNonProc.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const procAmount = processingFeeDollars(subBefore);
  const lines = [...mergedNonProc, { ...procTemplate, amount: procAmount }];
  const subtotal = Math.round((subBefore + procAmount) * 100) / 100;
  return { lines, subtotal, subtotal_model: built.subtotal };
}

export function priceFromMargin(subtotal: number, marginFraction: number): number {
  const m = Math.min(0.5, Math.max(0.25, marginFraction));
  if (subtotal <= 0) return 0;
  return subtotal / (1 - m);
}

export function defaultRoundedClientPrice(suggestedPreTax: number): number {
  if (!Number.isFinite(suggestedPreTax) || suggestedPreTax <= 0) return 0;
  return Math.round(suggestedPreTax / 10) * 10;
}

export function hstOnPrice(preTax: number, rate = 0.13): number {
  return Math.round(Math.max(0, preTax) * rate * 100) / 100;
}
