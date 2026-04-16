/**
 * Estimated job duration and margin alert threshold for crew/admin (not client-facing).
 */

export type JobDurationEstimate = {
  loadingMinutes: number
  driveMinutes: number
  unloadingMinutes: number
  bufferMinutes: number
  totalMinutes: number
  totalHours: number
  displayTime: string
  grossRevenue: number
  estimatedCost: number
  grossMargin: number
  marginPercent: number
  maxMinutesBeforeMarginAlert: number
}

/**
 * Raw margin alert = planned minutes + (50% of gross margin in CAD) / (crew labour $/min).
 * When quoted revenue is high vs this model's estimated cost, that "runway" projects to
 * many hours and no longer matches operational job length. Cap so crew/admin thresholds
 * stay near planned duration (90 min extra or 1.5× plan, whichever is higher).
 */
export function capMarginAlertMinutes(
  plannedMinutes: number,
  uncappedAlertMinutes: number,
): number {
  const p = Math.round(plannedMinutes)
  if (
    !Number.isFinite(uncappedAlertMinutes) ||
    uncappedAlertMinutes <= 0
  ) {
    return uncappedAlertMinutes
  }
  if (!Number.isFinite(p) || p <= 0) {
    return Math.round(uncappedAlertMinutes)
  }
  const softCap = Math.max(p + 90, Math.round(p * 1.5))
  return Math.min(Math.round(uncappedAlertMinutes), softCap)
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function estimateDriveTimeFromKm(distanceKm: number): number {
  if (distanceKm <= 20) return 30
  if (distanceKm <= 50) return Math.round(30 + (distanceKm - 20) * 1.2)
  if (distanceKm <= 100) return Math.round(66 + (distanceKm - 50) * 0.9)
  return Math.round(111 + (distanceKm - 100) * 0.7)
}

function estimateTruckCost(truckType: string | null, totalHours: number): number {
  const t = (truckType || "").toLowerCase()
  if (t.includes("sprinter") || t.includes("van")) return totalHours * 35
  if (t.includes("26") || t.includes("five") || t.includes("5-ton")) return totalHours * 55
  return totalHours * 45
}

function estimateFuelCost(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0
  return Math.min(120, Math.round(distanceKm * 0.45))
}

const ACCESS_LOAD_MOD: Record<string, number> = {
  elevator: 1.0,
  ground: 0.9,
  walk_up_2nd: 1.15,
  walk_up_3rd: 1.3,
  walk_up_4th: 1.5,
  loading_dock: 0.85,
  concierge: 1.0,
  long_carry: 1.1,
  narrow_stairs: 1.25,
}

const CREW_EFF: Record<number, number> = {
  1: 1.6,
  2: 1.0,
  3: 0.75,
  4: 0.6,
  5: 0.52,
  6: 0.45,
}

export function estimateJobDuration(input: {
  serviceType: string
  inventoryScore: number
  itemCount: number
  crewSize: number
  fromAccess: string
  toAccess: string
  distanceKm: number | null
  driveTimeMinutes: number | null
  hasLongCarry: boolean
  tier: string | null
  truckType: string | null
  grossRevenue: number
  bookedHours: number | null
}): JobDurationEstimate {
  const st = (input.serviceType || "").toLowerCase()
  let loadingMinutes = 60

  if (st === "residential" || st === "local_move" || st === "long_distance") {
    const s = input.inventoryScore
    if (s < 30) loadingMinutes = 45
    else if (s < 60) loadingMinutes = 45 + (s - 30) * 2
    else if (s < 100) loadingMinutes = 105 + (s - 60) * 2
    else loadingMinutes = 185 + (s - 100) * 1.5
  } else if (st === "b2b_delivery" || st === "b2b_oneoff") {
    loadingMinutes = Math.max(30, input.itemCount * 5)
  } else if (st === "event") {
    loadingMinutes = Math.max(30, input.itemCount * 4)
  } else if (st === "single_item") {
    loadingMinutes = 20
  } else if (st === "labour_only") {
    const bh = input.bookedHours ?? 3
    loadingMinutes = bh * 60
  } else {
    loadingMinutes = 75
  }

  const fromM = ACCESS_LOAD_MOD[input.fromAccess] ?? 1.0
  loadingMinutes *= fromM

  const crewEff = CREW_EFF[input.crewSize] ?? 1.0
  loadingMinutes *= crewEff

  const dk = input.distanceKm ?? 0
  const driveMinutes =
    input.driveTimeMinutes != null && input.driveTimeMinutes > 0
      ? input.driveTimeMinutes
      : dk > 0
        ? estimateDriveTimeFromKm(dk)
        : 30

  let unloadingMinutes = loadingMinutes * 0.85
  const toM = ACCESS_LOAD_MOD[input.toAccess] ?? 1.0
  unloadingMinutes *= toM

  const tier = (input.tier || "").toLowerCase()
  if (tier === "estate") {
    loadingMinutes *= 1.2
    unloadingMinutes *= 1.25
  } else if (tier === "signature") {
    loadingMinutes *= 1.1
    unloadingMinutes *= 1.1
  }

  if (input.hasLongCarry) {
    loadingMinutes *= 1.1
    unloadingMinutes *= 1.1
  }

  const rawTotal = loadingMinutes + driveMinutes + unloadingMinutes
  const bufferMinutes = Math.round(rawTotal * 0.1)
  const totalMinutes = Math.round(rawTotal + bufferMinutes)
  const totalHours = totalMinutes / 60

  const crewHourlyRate = 28
  const estimatedCost =
    input.crewSize * totalHours * crewHourlyRate +
    estimateTruckCost(input.truckType, totalHours) +
    estimateFuelCost(dk)

  const grossRevenue = Math.max(0, input.grossRevenue)
  const grossMargin = grossRevenue - estimatedCost
  const marginPercent =
    grossRevenue > 0 ? Math.round((grossMargin / grossRevenue) * 100) : 0

  const costPerMinute = (input.crewSize * crewHourlyRate) / 60
  const marginBuffer = grossMargin * 0.5
  const extraMinutesAllowed =
    costPerMinute > 0 ? marginBuffer / costPerMinute : 0
  const uncappedMarginAlert = Math.round(
    totalMinutes + Math.max(0, extraMinutesAllowed),
  )
  const maxMinutesBeforeMarginAlert = capMarginAlertMinutes(
    totalMinutes,
    uncappedMarginAlert,
  )

  return {
    loadingMinutes: Math.round(loadingMinutes),
    driveMinutes: Math.round(driveMinutes),
    unloadingMinutes: Math.round(unloadingMinutes),
    bufferMinutes,
    totalMinutes,
    totalHours: Math.round(totalHours * 10) / 10,
    displayTime: formatDurationMinutes(totalMinutes),
    grossRevenue,
    estimatedCost: Math.round(estimatedCost),
    grossMargin: Math.round(grossMargin),
    marginPercent,
    maxMinutesBeforeMarginAlert,
  }
}

/** Derive duration fields when creating a move from a paid quote (non-B2B move path). */
export function estimateMoveDurationFromQuoteRow(params: {
  serviceType: string | null
  moveType: string | null
  distanceKm: number | null
  driveTimeMin: number | null
  estCrewSize: number | null
  estHours: number | null
  inventoryScore: number | null
  fromAccess: string | null
  toAccess: string | null
  fromLongCarry: boolean
  toLongCarry: boolean
  tierSelected: string | null
  truckPrimary: string | null
  grossRevenue: number
  factors: Record<string, unknown>
}): JobDurationEstimate | null {
  const st =
    (params.serviceType || params.moveType || "local_move").toLowerCase()
  if (st === "bin_rental") return null

  const inv =
    params.inventoryScore ??
    (typeof params.factors.inventory_score === "number"
      ? params.factors.inventory_score
      : 45)
  const items = Array.isArray(params.factors.inventory_items)
    ? (params.factors.inventory_items as unknown[]).length
    : Math.max(1, Math.round(inv / 8))

  const crew = Math.max(
    1,
    Math.min(
      6,
      params.estCrewSize ??
        (typeof params.factors.estimated_crew === "number"
          ? params.factors.estimated_crew
          : 2),
    ),
  )

  const labourHrs =
    params.estHours ??
    (typeof params.factors.est_job_hours === "number"
      ? params.factors.est_job_hours
      : null)

  return estimateJobDuration({
    serviceType: st,
    inventoryScore: inv,
    itemCount: items,
    crewSize: crew,
    fromAccess: (params.fromAccess || "ground").toLowerCase(),
    toAccess: (params.toAccess || "ground").toLowerCase(),
    distanceKm: params.distanceKm,
    driveTimeMinutes: params.driveTimeMin,
    hasLongCarry: params.fromLongCarry || params.toLongCarry,
    tier: params.tierSelected,
    truckType: params.truckPrimary,
    grossRevenue: params.grossRevenue,
    bookedHours: labourHrs,
  })
}

/**
 * Client-safe fallback when `moves.estimated_duration_minutes` was never backfilled
 * (older rows, manual jobs). Uses the same model as quote-to-move creation.
 */
export function estimateDurationFromMoveRow(
  m: Record<string, unknown>,
): JobDurationEstimate | null {
  const factors =
    m.factors_applied && typeof m.factors_applied === "object"
      ? (m.factors_applied as Record<string, unknown>)
      : {}
  const grossRaw = Number(m.estimate ?? m.amount ?? 0)
  const grossRevenue = grossRaw > 0 ? grossRaw : 2500

  return estimateMoveDurationFromQuoteRow({
    serviceType: (m.service_type as string | null) ?? null,
    moveType: (m.move_type as string | null) ?? null,
    distanceKm:
      m.distance_km != null && Number.isFinite(Number(m.distance_km))
        ? Number(m.distance_km)
        : null,
    driveTimeMin:
      m.drive_time_min != null && Number.isFinite(Number(m.drive_time_min))
        ? Number(m.drive_time_min)
        : null,
    estCrewSize:
      m.est_crew_size != null && Number.isFinite(Number(m.est_crew_size))
        ? Number(m.est_crew_size)
        : null,
    estHours:
      m.est_hours != null && Number.isFinite(Number(m.est_hours))
        ? Number(m.est_hours)
        : null,
    inventoryScore:
      m.inventory_score != null && Number.isFinite(Number(m.inventory_score))
        ? Number(m.inventory_score)
        : null,
    fromAccess: (m.from_access as string | null) ?? null,
    toAccess: (m.to_access as string | null) ?? null,
    fromLongCarry: !!(m as { from_long_carry?: boolean }).from_long_carry,
    toLongCarry: !!(m as { to_long_carry?: boolean }).to_long_carry,
    tierSelected: (m.tier_selected as string | null) ?? null,
    truckPrimary: (m.truck_primary as string | null) ?? null,
    grossRevenue,
    factors,
  })
}
