import type { BuildingAccessFlag, BuildingProfileRow } from "./types"

export function estimatedTripsFromInventoryScore(inventoryScore: number): number {
  const s = inventoryScore
  if (s < 30) return 35
  if (s < 60) return 60
  if (s < 100) return 90
  return 140
}

function crewSizeForInventory(inventoryScore: number): number {
  if (inventoryScore < 30) return 2
  if (inventoryScore < 60) return 2
  return 3
}

/** Extra load minutes at origin; extra unload minutes at destination (trips × minutes per trip). */
export function buildingDurationExtrasFromProfile(
  building: BuildingProfileRow | null,
  inventoryScore: number,
): { loadingExtraMinutes: number; unloadingExtraMinutes: number } {
  if (!building?.estimated_extra_minutes_per_trip || building.estimated_extra_minutes_per_trip <= 0) {
    return { loadingExtraMinutes: 0, unloadingExtraMinutes: 0 }
  }
  const trips = estimatedTripsFromInventoryScore(inventoryScore)
  const per = building.estimated_extra_minutes_per_trip
  const total = trips * per
  return { loadingExtraMinutes: total, unloadingExtraMinutes: total }
}

const FLAG_SYNTHETIC: Record<
  BuildingAccessFlag,
  { complexity: number; extraMinutesPerTrip: number }
> = {
  commercial_tenants: { complexity: 3, extraMinutesPerTrip: 6 },
  multi_elevator_transfer: { complexity: 4, extraMinutesPerTrip: 10 },
  dock_restrictions: { complexity: 3, extraMinutesPerTrip: 5 },
  high_floor: { complexity: 3, extraMinutesPerTrip: 4 },
  older_small_elevator: { complexity: 3, extraMinutesPerTrip: 5 },
}

export function syntheticComplexityFromFlags(flags: BuildingAccessFlag[]): {
  complexityRating: number
  estimatedExtraMinutesPerTrip: number
} {
  if (!flags.length) return { complexityRating: 1, estimatedExtraMinutesPerTrip: 0 }
  let maxC = 1
  let maxExtra = 0
  for (const f of flags) {
    const row = FLAG_SYNTHETIC[f]
    if (!row) continue
    maxC = Math.max(maxC, row.complexity)
    maxExtra = Math.max(maxExtra, row.extraMinutesPerTrip)
  }
  return { complexityRating: maxC, estimatedExtraMinutesPerTrip: maxExtra }
}

export function buildingComplexitySurchargePreTax(params: {
  building: BuildingProfileRow | null
  /** When no DB row, use flags-based synthetic complexity */
  syntheticFlags?: BuildingAccessFlag[]
  inventoryScore: number
  crewLoadedHourlyRate: number
  /** Default 1.45 */
  marginMultiplier: number
  /** Round to nearest dollars (e.g. 25) */
  roundingNearest: number
}): { charge: number; flags: string[]; loadingExtraMinutes: number; unloadingExtraMinutes: number } {
  const flags: string[] = []
  let complexityRating = params.building?.complexity_rating ?? 1
  let extraMin = params.building?.estimated_extra_minutes_per_trip ?? 0

  if (!params.building && params.syntheticFlags && params.syntheticFlags.length > 0) {
    const syn = syntheticComplexityFromFlags(params.syntheticFlags)
    complexityRating = syn.complexityRating
    extraMin = syn.estimatedExtraMinutesPerTrip
    if (complexityRating >= 3 && extraMin > 0) {
      flags.push(`Reported access details: ${params.syntheticFlags.join(", ")}`)
    }
  }

  if (complexityRating < 3 || extraMin <= 0) {
    return { charge: 0, flags, loadingExtraMinutes: 0, unloadingExtraMinutes: 0 }
  }

  const trips = estimatedTripsFromInventoryScore(params.inventoryScore)
  const totalExtraMinutes = trips * extraMin
  const crew = crewSizeForInventory(params.inventoryScore)
  const extraLabourCost = (totalExtraMinutes / 60) * crew * params.crewLoadedHourlyRate
  const withMargin = extraLabourCost * params.marginMultiplier
  const rn = Math.max(1, params.roundingNearest)
  const charge = Math.round(withMargin / rn) * rn

  const dur = buildingDurationExtrasFromProfile(
    {
      ...params.building,
      complexity_rating: complexityRating,
      estimated_extra_minutes_per_trip: extraMin,
    } as BuildingProfileRow,
    params.inventoryScore,
  )

  const label =
    params.building?.building_name?.trim() ||
    (params.building?.address?.trim()
      ? params.building.address.trim()
      : "Reported access")
  flags.push(
    `${label}: complexity ${complexityRating}/5, about ${Math.round((totalExtraMinutes / 60) * 10) / 10} extra crew hours (estimate)`,
  )

  return {
    charge,
    flags,
    loadingExtraMinutes: dur.loadingExtraMinutes,
    unloadingExtraMinutes: dur.unloadingExtraMinutes,
  }
}
