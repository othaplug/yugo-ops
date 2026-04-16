/**
 * Single source for per-job truck allocation fees (platform_config truck_fee_* keys).
 * Defaults match seed migration when config is missing.
 */

export const DEFAULT_TRUCK_FEES: Record<string, number> = {
  sprinter: 80,
  "16ft": 140,
  "20ft": 200,
  "24ft": 240,
  "26ft": 280,
  none: 0,
}

function readConfigValue(
  config: Map<string, string> | Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!config) return undefined
  if (config instanceof Map) return config.get(key)
  const v = (config as Record<string, unknown>)[key]
  if (v === undefined || v === null) return undefined
  return String(v)
}

/** Normalize to sprinter | 16ft | 20ft | 24ft | 26ft | none */
export function normalizeTruckTypeForFee(raw: string | undefined | null): string {
  const k = (raw || "sprinter").toLowerCase().replace(/\s+/g, "")
  if (k === "none" || k === "notruck" || k === "no_truck") return "none"
  if (k === "sprinter" || k === "16ft" || k === "20ft" || k === "24ft" || k === "26ft") return k
  if (k.includes("16")) return "16ft"
  if (k.includes("24")) return "24ft"
  if (k.includes("20")) return "20ft"
  if (k.includes("26")) return "26ft"
  return "sprinter"
}

function platformKeyForTruck(normalized: string): string {
  return `truck_fee_${normalized.replace(/[^a-z0-9]/gi, "_")}`
}

/**
 * Sync lookup: pass platform_config as Map or plain object (e.g. QuoteForm `config` prop).
 */
export function getTruckFeeSync(
  truckType: string,
  config: Map<string, string> | Record<string, unknown> | null | undefined,
): number {
  const normalized = normalizeTruckTypeForFee(truckType)
  if (normalized === "none") return 0
  const key = platformKeyForTruck(normalized)
  const raw = readConfigValue(config, key)
  if (raw !== undefined && raw !== "") {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return DEFAULT_TRUCK_FEES[normalized] ?? DEFAULT_TRUCK_FEES.sprinter
}

export async function getTruckFee(
  truckType: string,
  config?: Map<string, string> | Record<string, unknown> | null,
): Promise<number> {
  return getTruckFeeSync(truckType, config ?? null)
}

export function getAllTruckFees(
  config: Map<string, string> | Record<string, unknown> | null | undefined,
): Record<string, number> {
  return {
    sprinter: getTruckFeeSync("sprinter", config),
    "16ft": getTruckFeeSync("16ft", config),
    "20ft": getTruckFeeSync("20ft", config),
    "24ft": getTruckFeeSync("24ft", config),
    "26ft": getTruckFeeSync("26ft", config),
  }
}

/** UI / breakdown: amount above sprinter fee (for "16ft (+$60)" style lines). */
export function truckFeeIncrementOverSprinter(
  truckType: string,
  config: Map<string, string> | Record<string, unknown> | null | undefined,
): number {
  if (normalizeTruckTypeForFee(truckType) === "none") return 0
  const fee = getTruckFeeSync(truckType, config)
  const spr = getTruckFeeSync("sprinter", config)
  return Math.max(0, fee - spr)
}

export function formatTruckOptionLabel(
  value: string,
  config: Map<string, string> | Record<string, unknown> | null | undefined,
): string {
  if (value === "none") return "No truck (on-site)"
  const n = normalizeTruckTypeForFee(value)
  if (n === "none") return "No truck (on-site)"
  const pretty =
    value === "sprinter" || n === "sprinter"
      ? "Sprinter"
      : `${String(value).replace(/ft$/i, "")}ft`
  const inc = truckFeeIncrementOverSprinter(value, config)
  if (inc <= 0) return `${pretty} (base)`
  return `${pretty} (+$${inc})`
}

/** Event / non-residential: label uses increment vs sprinter so Sprinter stays "(base)". */
export function formatTruckBreakdownLine(
  truckType: string,
  config: Map<string, string> | Record<string, unknown> | null | undefined,
): string {
  const normalized = normalizeTruckTypeForFee(truckType)
  if (normalized === "none") return "No truck (on-site)"
  const labels: Record<string, string> = {
    sprinter: "Sprinter",
    "16ft": "16ft",
    "20ft": "20ft",
    "24ft": "24ft",
    "26ft": "26ft",
  }
  const name = labels[normalized] ?? truckType
  const inc = truckFeeIncrementOverSprinter(truckType, config)
  return inc > 0 ? `Truck: ${name} (+$${inc})` : `Truck: ${name} (base)`
}

/** Residential: upgrade dollars are vs tier baseline truck, not vs sprinter. */
export function formatTruckResidentialUpgradeLine(
  truckType: string,
  upgradeAmountAddedToQuote: number,
): string {
  const normalized = normalizeTruckTypeForFee(truckType)
  if (normalized === "none") return "No truck (on-site)"
  const labels: Record<string, string> = {
    sprinter: "Sprinter",
    "16ft": "16ft",
    "20ft": "20ft",
    "24ft": "24ft",
    "26ft": "26ft",
  }
  const name = labels[normalized] ?? truckType
  return upgradeAmountAddedToQuote > 0
    ? `Truck: ${name} (+$${upgradeAmountAddedToQuote})`
    : `Truck: ${name} (base)`
}
