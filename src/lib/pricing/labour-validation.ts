/**
 * Post-hoc labour rate validation: compares implied $/hr per mover to configurable
 * competitive bands. Does not affect quote math.
 */

import { getTruckFeeSync } from "@/lib/pricing/truck-fees"

export type LabourValidationStatus = "within_range" | "above_ceiling" | "below_floor" | "not_applicable"

export interface LabourRateCeilings {
  essential: { min: number; max: number }
  signature: { min: number; max: number }
  estate: { min: number; max: number }
  white_glove: { min: number; max: number }
  specialty: { min: number; max: number }
  event: { min: number; max: number }
  labour_only: { min: number; max: number }
  b2b: { min: number; max: number }
}

export const LABOUR_CEILINGS_DEFAULT: LabourRateCeilings = {
  essential: { min: 50, max: 80 },
  signature: { min: 55, max: 80 },
  estate: { min: 60, max: 150 },
  white_glove: { min: 60, max: 90 },
  specialty: { min: 65, max: 90 },
  event: { min: 55, max: 90 },
  labour_only: { min: 50, max: 80 },
  b2b: { min: 40, max: 75 },
}

/** platform_config keys (numeric strings) that override LABOUR_CEILINGS_DEFAULT when set */
export const LABOUR_RATE_CONFIG_KEYS = [
  "labour_rate_floor_essential",
  "labour_rate_ceiling_essential",
  "labour_rate_floor_signature",
  "labour_rate_ceiling_signature",
  "labour_rate_floor_estate",
  "labour_rate_ceiling_estate",
  "labour_rate_floor_white_glove",
  "labour_rate_ceiling_white_glove",
  "labour_rate_floor_specialty",
  "labour_rate_ceiling_specialty",
  "labour_rate_floor_event",
  "labour_rate_ceiling_event",
  "labour_rate_floor_labour_only",
  "labour_rate_ceiling_labour_only",
  "labour_rate_floor_b2b",
  "labour_rate_ceiling_b2b",
] as const

function cfgNum(config: Map<string, string> | undefined, key: string, fallback: number): number {
  if (!config) return fallback
  const v = config.get(key)
  if (v === undefined || v === "") return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function labourCeilingsFromPlatformConfig(config?: Map<string, string>): LabourRateCeilings {
  const d = LABOUR_CEILINGS_DEFAULT
  return {
    essential: {
      min: cfgNum(config, "labour_rate_floor_essential", d.essential.min),
      max: cfgNum(config, "labour_rate_ceiling_essential", d.essential.max),
    },
    signature: {
      min: cfgNum(config, "labour_rate_floor_signature", d.signature.min),
      max: cfgNum(config, "labour_rate_ceiling_signature", d.signature.max),
    },
    estate: {
      min: cfgNum(config, "labour_rate_floor_estate", d.estate.min),
      max: cfgNum(config, "labour_rate_ceiling_estate", d.estate.max),
    },
    white_glove: {
      min: cfgNum(config, "labour_rate_floor_white_glove", d.white_glove.min),
      max: cfgNum(config, "labour_rate_ceiling_white_glove", d.white_glove.max),
    },
    specialty: {
      min: cfgNum(config, "labour_rate_floor_specialty", d.specialty.min),
      max: cfgNum(config, "labour_rate_ceiling_specialty", d.specialty.max),
    },
    event: {
      min: cfgNum(config, "labour_rate_floor_event", d.event.min),
      max: cfgNum(config, "labour_rate_ceiling_event", d.event.max),
    },
    labour_only: {
      min: cfgNum(config, "labour_rate_floor_labour_only", d.labour_only.min),
      max: cfgNum(config, "labour_rate_ceiling_labour_only", d.labour_only.max),
    },
    b2b: {
      min: cfgNum(config, "labour_rate_floor_b2b", d.b2b.min),
      max: cfgNum(config, "labour_rate_ceiling_b2b", d.b2b.max),
    },
  }
}

export interface LabourValidationResult {
  effectiveRate: number
  ceiling: number
  floor: number
  status: LabourValidationStatus
  percentOfCeiling: number
  message: string | null
  labourComponent: number
  nonLabourComponent: number
  /** Which band was used (for diagnostics) */
  ceilingKey: keyof LabourRateCeilings
}

export interface LabourValidationQuoteInput {
  serviceType: string
  tier: string
  totalPrice: number
  crewSize: number
  estimatedHours: number
  truckType: string
  distanceKm: number
  specialtySurcharges: number
  accessSurcharges: number
}

function resolveCeilingKey(serviceType: string, tier: string): keyof LabourRateCeilings {
  const st = (serviceType || "").toLowerCase().trim()
  if (st === "b2b_delivery" || st === "b2b_oneoff" || st === "b2b_one_off") return "b2b"
  if (st === "white_glove") return "white_glove"
  if (st === "specialty") return "specialty"
  if (st === "event") return "event"
  if (st === "labour_only") return "labour_only"
  if (st === "local_move" || st === "long_distance") {
    const t = (tier || "essential").toLowerCase().trim()
    if (t === "signature") return "signature"
    if (t === "estate") return "estate"
    return "essential"
  }
  if (st === "office_move" || st === "single_item") return "essential"
  return "essential"
}

function suppliesEstimate(serviceType: string, tier: string): number {
  const st = (serviceType || "").toLowerCase()
  if (st === "event") return 20
  if (st === "white_glove") return 0
  const t = (tier || "").toLowerCase()
  if (t === "estate") return 120
  if (t === "signature") return 80
  return 45
}

/**
 * Validates implied labour rate from quote outputs.
 * @param platformConfig optional platform_config map for ceiling/floor overrides
 */
export function validateLabourRate(
  quote: LabourValidationQuoteInput,
  platformConfig?: Map<string, string>,
): LabourValidationResult {
  const LABOUR_CEILINGS = labourCeilingsFromPlatformConfig(platformConfig)

  const ceilingKey = resolveCeilingKey(quote.serviceType, quote.tier)
  const ceiling = LABOUR_CEILINGS[ceilingKey] ?? LABOUR_CEILINGS.essential

  const truckCost = getTruckFeeSync(quote.truckType, platformConfig ?? null)

  const fuelCost = Math.round(quote.distanceKm * 0.35)
  const suppliesCost = suppliesEstimate(quote.serviceType, quote.tier)
  const insuranceCost = 30

  const nonLabourComponent =
    truckCost +
    fuelCost +
    suppliesCost +
    insuranceCost +
    (quote.specialtySurcharges || 0) +
    (quote.accessSurcharges || 0)

  const labourComponent = Math.max(0, quote.totalPrice - nonLabourComponent)

  const totalLabourHours = quote.crewSize * quote.estimatedHours
  const effectiveRate =
    totalLabourHours > 0 ? Math.round((labourComponent / totalLabourHours) * 100) / 100 : 0

  if (totalLabourHours <= 0) {
    return {
      effectiveRate: 0,
      ceiling: ceiling.max,
      floor: ceiling.min,
      status: "not_applicable",
      percentOfCeiling: 0,
      message: null,
      labourComponent: Math.round(labourComponent),
      nonLabourComponent: Math.round(nonLabourComponent),
      ceilingKey,
    }
  }

  if (ceilingKey === "estate") {
    return {
      effectiveRate,
      ceiling: ceiling.max,
      floor: ceiling.min,
      status: "not_applicable",
      percentOfCeiling: ceiling.max > 0 ? Math.round((effectiveRate / ceiling.max) * 100) : 0,
      message: null,
      labourComponent: Math.round(labourComponent),
      nonLabourComponent: Math.round(nonLabourComponent),
      ceilingKey,
    }
  }

  let status: LabourValidationStatus = "within_range"
  let message: string | null = null

  if (effectiveRate > ceiling.max) {
    status = "above_ceiling"
    message =
      `Labour rate $${effectiveRate.toFixed(0)}/hr per mover exceeds ${String(ceilingKey)} ceiling of $${ceiling.max}/hr. ` +
      `Review: crew size may be too small for this move, or the price is above market for this tier.`
  } else if (effectiveRate < ceiling.min) {
    status = "below_floor"
    message =
      `Labour rate $${effectiveRate.toFixed(0)}/hr per mover is below ${String(ceilingKey)} floor of $${ceiling.min}/hr. ` +
      `This move may be underpriced. Margin risk.`
  }

  return {
    effectiveRate,
    ceiling: ceiling.max,
    floor: ceiling.min,
    status,
    percentOfCeiling: ceiling.max > 0 ? Math.round((effectiveRate / ceiling.max) * 100) : 0,
    message,
    labourComponent: Math.round(labourComponent),
    nonLabourComponent: Math.round(nonLabourComponent),
    ceilingKey,
  }
}

function num(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0
}

/** Sums access-style surcharges allocated out of labour in the heuristic model */
export function aggregateAccessSurchargesForLabourValidation(factors: Record<string, unknown>): number {
  return (
    num(factors.access_surcharge) +
    num(factors.parking_long_carry_total) +
    num(factors.deadhead_surcharge) +
    num(factors.mobilization_fee)
  )
}

/** Item / weight / handling surcharges treated as non-labour for the check */
export function aggregateSpecialtySurchargesForLabourValidation(
  serviceType: string,
  factors: Record<string, unknown>,
): number {
  let s = num(factors.specialty_surcharge)
  const st = (serviceType || "").toLowerCase()

  if (st === "single_item") {
    s += num(factors.assembly_surcharge)
  }
  if (st === "specialty") {
    s += num(factors.crating_surcharge) + num(factors.climate_surcharge)
  }
  if (st === "white_glove") {
    // Item subtotal and assembly are priced as labour in the WG item model; only pass-through / access style lines count as non-labour here.
    s +=
      num(factors.white_glove_debris_fee) +
      num(factors.white_glove_declared_value_premium) +
      num(factors.white_glove_guaranteed_window_fee) +
      num(factors.white_glove_distance_surcharge)
  }
  if (st === "b2b_delivery" || st === "b2b_oneoff") {
    s += num(factors.weight_surcharge)
  }
  if (st === "event") {
    s += num(factors.event_wrapping_surcharge) + num(factors.setup_fee)
  }

  return Math.round(s)
}

export function resolveLabourValidationCrewHours(
  svcType: string,
  labour: { crewSize: number; estimatedHours: number } | null,
  displayCrew: number | null,
  displayHours: number | null,
  factors: Record<string, unknown>,
): { crewSize: number; estimatedHours: number } {
  const st = (svcType || "").toLowerCase()

  const firstPositive = (...vals: number[]) => {
    for (const v of vals) {
      if (v > 0) return v
    }
    return 0
  }

  let crew = firstPositive(
    displayCrew ?? 0,
    num(factors.office_crew_estimated),
    num(factors.b2b_crew),
    num(factors.event_crew),
    num(factors.crew_size),
    labour?.crewSize ?? 0,
  )
  if (crew <= 0) crew = 2

  let hours = firstPositive(
    displayHours ?? 0,
    num(factors.office_hours_estimated),
    num(factors.b2b_estimated_hours),
    num(factors.event_hours),
    labour?.estimatedHours ?? 0,
  )
  if (hours <= 0) hours = 5

  const sjc = num(factors.single_item_crew_estimated)
  const sjh = num(factors.single_item_hours_estimated)
  if (st === "single_item") {
    if (sjc > 0) crew = sjc
    if (sjh > 0) hours = sjh
  }

  const wgc = num(factors.white_glove_crew)
  const wgh = num(factors.white_glove_hours)
  if (st === "white_glove") {
    if (wgc > 0) crew = wgc
    if (wgh > 0) hours = wgh
  }

  if (st === "specialty") {
    const th = num(factors.timeline_hours)
    if (th > 0) hours = th
    crew = Math.max(2, Math.round(crew))
  }

  if (st === "long_distance") {
    crew = Math.max(3, Math.round(crew))
    hours = Math.max(8, hours)
  }

  if (st === "labour_only") {
    const cs = num(factors.crew_size)
    const h = num(factors.hours)
    if (cs > 0) crew = cs
    if (h > 0) hours = h
  }

  crew = Math.max(1, Math.round(crew))
  hours = Math.max(0.25, hours)

  return { crewSize: crew, estimatedHours: hours }
}

export function truckTypeForLabourValidation(factors: Record<string, unknown>): string {
  const tr = factors.truck_recommended
  if (typeof tr === "string" && tr.trim()) return tr
  return "sprinter"
}
