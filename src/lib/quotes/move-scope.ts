/**
 * Residential move scope: day count detection and flat multi-day add-ons (Generate Quote Phase A).
 * Shared by admin quote UI and quotes/generate API.
 */

export type MoveScopeTier = "essential" | "signature" | "estate"

export type MoveScopeDetectionInput = {
  tier: MoveScopeTier | string
  move_size: string
  specialty_items?: { type: string; qty: number }[]
  /** When true, coordinator selected crating pieces on the quote form */
  crating_required?: boolean
  /** Slug identifiers from addon selections (lowercased for matching) */
  addon_slugs: string[]
}

export type MoveScopePricingInput = MoveScopeDetectionInput & {
  /** When set (1–14), replaces auto day count for quotes.estimated_days only. */
  estimated_days_override?: number | null
  /** Coordinator adds another full move-style day (large volume) at multi_day_rate. */
  optional_additional_volume_day?: boolean
}

const CRATING_SPECIALTY_TYPES = new Set([
  "piano_grand",
  "artwork",
  "antique",
  "wine_collection",
])

function normSize(ms: string | undefined): string {
  return (ms || "2br").toLowerCase().trim().replace(/\s+/g, "_").replace(/bedroom/g, "br")
}

export function detectDayCount(input: MoveScopeDetectionInput): number {
  let days = 1
  const ms = normSize(input.move_size)
  const tier = String(input.tier || "signature").toLowerCase()

  // ─────────────────────────────────────────────────────────────────────────
  // Day-rate billing (Mode B) — STRUCTURAL triggers only.
  //
  // Packing/unpacking ADD-ONS (full_packing, unpacking slugs) are Mode A:
  // they bill a flat fee via the addons table (`calculateAddons`) and the
  // crew packs/unpacks within the single move day on standard 1BR/2BR moves.
  // They MUST NOT also trigger a separate $650 day rate here or the quote
  // double-charges the client (see YG-30238).
  //
  // Structural multi-day triggers:
  //   - Estate tier with large home (3BR+)
  //   - 4BR / 5BR_plus (inherently multi-day regardless of tier)
  //   - Specialty crating
  //   - 5BR_plus extra volume day
  // ─────────────────────────────────────────────────────────────────────────
  const isLargeHome = ms === "3br" || ms === "4br" || ms === "5br_plus"

  const hasPacking =
    (tier === "estate" && isLargeHome) || ms === "4br" || ms === "5br_plus"

  if (hasPacking) days += 1

  const hasUnpacking = tier === "estate" && isLargeHome

  if (hasUnpacking) days += 1

  const hasSpecialtyCrating =
    input.specialty_items?.some((it) => CRATING_SPECIALTY_TYPES.has(it.type)) ?? false
  const hasCrating = hasSpecialtyCrating && !!input.crating_required

  if (hasCrating) days += 1

  if (ms === "5br_plus") days += 1

  return Math.min(Math.max(days, 1), 14)
}

function formatMoveSizeForReason(msNorm: string): string {
  if (msNorm === "studio") return "Studio"
  if (msNorm === "partial") return "Partial move"
  if (msNorm === "5br_plus") return "5+ bedroom"
  const m = msNorm.match(/^(\d)br$/)
  if (m?.[1]) return `${m[1]} bedroom`
  return msNorm.replace(/_/g, " ")
}

/** Human factors for the coordinator line under “Days needed”. */
export function describeMoveScopeAutoReason(input: MoveScopeDetectionInput): string {
  const parts: string[] = []
  const tier = String(input.tier || "signature").toLowerCase()
  if (tier === "estate") parts.push("Estate")
  else if (tier === "essential") parts.push("Essential")
  else parts.push("Signature")

  const ms = normSize(input.move_size)
  parts.push(formatMoveSizeForReason(ms))

  // Packing/unpacking add-on slugs are intentionally NOT listed here as
  // day-driving factors. They are flat-fee add-ons (Mode A) and do not
  // expand the schedule into additional billed days. See detectDayCount.
  const hasSpecialtyCrating =
    input.specialty_items?.some((it) => CRATING_SPECIALTY_TYPES.has(it.type)) ?? false
  if (hasSpecialtyCrating && input.crating_required) parts.push("specialty crating")

  return `${detectDayCount(input)} days (${parts.join(" · ")})`
}

export type ScopeAddonLine = {
  label: string
  amount: number
  kind: "pack_day" | "unpack_day" | "crating_day" | "volume_day" | "schedule_buffer_day"
}

export type MoveScopePricingResult = {
  detectedDays: number
  effectiveDays: number
  totalAddonPreTax: number
  lines: ScopeAddonLine[]
  /** Stored on quotes.day_breakdown */
  breakdownJson: Array<{ day: number; type: string; rate: number }>
  /** Short labels for client email or timeline */
  daySummaryParts: string[]
}

function cfgNum(map: Map<string, string>, key: string, fallback: number): number {
  const v = map.get(key)
  return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback
}

/**
 * Flat-rate add-ons applied equally to Essential / Signature / Estate pre-tax totals,
 * after the core pricing engine (aligned with Phase A prompt).
 */
export function computeMoveScopeAddonPreTax(
  config: Map<string, string>,
  input: MoveScopePricingInput,
): MoveScopePricingResult {
  const ms = normSize(input.move_size)
  const tier = String(input.tier || "signature").toLowerCase()

  // ─────────────────────────────────────────────────────────────────────────
  // Day-rate billing (Mode B) — STRUCTURAL triggers only.
  //
  // Packing/unpacking ADD-ON slugs are deliberately NOT consulted here.
  // They bill a flat fee via the addons table (`calculateAddons`) and the
  // crew packs/unpacks within the single move day on standard moves. Adding
  // a $650 day rate here on top of the add-on fee would double-charge the
  // client (the YG-30238 bug). See detectDayCount for the same rule.
  // ─────────────────────────────────────────────────────────────────────────
  const isLargeHome = ms === "3br" || ms === "4br" || ms === "5br_plus"

  const hasPacking =
    (tier === "estate" && isLargeHome) || ms === "4br" || ms === "5br_plus"

  const hasUnpacking = tier === "estate" && isLargeHome

  const hasSpecialtyCrating =
    input.specialty_items?.some((it) => CRATING_SPECIALTY_TYPES.has(it.type)) ?? false
  const hasCrating = hasSpecialtyCrating && !!input.crating_required

  const packDayRate = cfgNum(config, "pack_day_rate", 650)
  const moveDayRate = cfgNum(config, "multi_day_rate", 850)

  const lines: ScopeAddonLine[] = []

  if (hasPacking) {
    lines.push({
      kind: "pack_day",
      label: "Packing day",
      amount: packDayRate,
    })
  }
  if (hasUnpacking) {
    lines.push({
      kind: "unpack_day",
      label: "Unpacking day",
      amount: packDayRate,
    })
  }
  if (hasCrating) {
    lines.push({
      kind: "crating_day",
      label: "Crating day",
      amount: moveDayRate,
    })
  }
  if (ms === "5br_plus") {
    lines.push({
      kind: "volume_day",
      label: "Large volume day",
      amount: moveDayRate,
    })
  }

  if (input.optional_additional_volume_day) {
    lines.push({
      kind: "volume_day",
      label: "Additional move day",
      amount: moveDayRate,
    })
  }

  const totalAddonPreTaxBase = lines.reduce((s, l) => s + l.amount, 0)

  const detectedDays = detectDayCount(input)

  const breakdownJson: MoveScopePricingResult["breakdownJson"] = []
  let dayCursor = 1
  const summary: string[] = []
  if (hasPacking) {
    breakdownJson.push({ day: dayCursor++, type: "pack", rate: packDayRate })
    summary.push("Packing")
  }
  if (hasCrating) {
    breakdownJson.push({ day: dayCursor++, type: "crating", rate: moveDayRate })
    summary.push("Crating")
  }
  // Extra volume/loading days come before the move day for very large homes
  if (ms === "5br_plus") {
    breakdownJson.push({ day: dayCursor++, type: "volume", rate: moveDayRate })
  }
  if (input.optional_additional_volume_day) {
    breakdownJson.push({
      day: dayCursor++,
      type: "volume",
      rate: moveDayRate,
    })
  }
  // Move day: always after packing/loading, always before unpacking.
  // pack → crating → volume → move → unpack is the correct chronological order.
  breakdownJson.push({ day: dayCursor++, type: "move", rate: 0 })
  summary.push("Moving")
  if (hasUnpacking) {
    breakdownJson.push({ day: dayCursor++, type: "unpack", rate: packDayRate })
    summary.push("Unpacking")
  }

  const plannedDaysBeforePad = breakdownJson.length
  const ov = input.estimated_days_override
  let effectiveDays = Math.max(detectedDays, plannedDaysBeforePad)
  if (typeof ov === "number" && Number.isFinite(ov)) {
    effectiveDays = Math.min(14, Math.max(1, Math.round(ov)))
  }

  let bufferAddon = 0
  const padLines: ScopeAddonLine[] = []
  if (effectiveDays > breakdownJson.length) {
    const pad = effectiveDays - breakdownJson.length
    bufferAddon = pad * moveDayRate
    for (let p = 0; p < pad; p++) {
      padLines.push({
        kind: "schedule_buffer_day",
        label: `Extra schedule day ${p + 1}`,
        amount: moveDayRate,
      })
    }
    const insertAt = Math.max(0, breakdownJson.length - 1)
    for (let p = 0; p < pad; p++) {
      breakdownJson.splice(insertAt, 0, {
        day: 0,
        type: "volume",
        rate: moveDayRate,
      })
    }
  }

  breakdownJson.forEach((row, i) => {
    row.day = i + 1
  })

  const combinedLines = lines.concat(padLines)
  const totalAddonPreTax = totalAddonPreTaxBase + bufferAddon

  const daySummaryParts = summary.length > 0 ? summary : ["Moving"]

  return {
    detectedDays,
    effectiveDays,
    totalAddonPreTax,
    lines: combinedLines,
    breakdownJson,
    daySummaryParts,
  }
}

const CLIENT_DAY_COPY: Record<string, string> = {
  pack: "Professional packing",
  move: "Moving day",
  unpack: "Unpacking and setup",
  crating: "Crating and specialty prep",
  volume: "Additional load or volume day",
}

/** Short lines for client quote and email (no internal phase names). */
export function buildMoveScopeClientSchedule(args: {
  breakdown: Array<{ type?: string }>
}): { serviceLabel: string; dayLines: string[] } {
  const rows = args.breakdown.filter(Boolean)
  if (rows.length <= 1) {
    return { serviceLabel: "", dayLines: [] }
  }
  const dayLines = rows.map((r, i) => {
    const t = String(r.type || "move").toLowerCase()
    const label = CLIENT_DAY_COPY[t] ?? CLIENT_DAY_COPY.move!
    return `Day ${i + 1}: ${label}`
  })
  const n = rows.length
  return {
    serviceLabel: `${n}-day service`,
    dayLines,
  }
}

export function clampEstimatedDaysOverride(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  const n = typeof raw === "number" ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return null
  return Math.min(14, Math.max(1, Math.round(n)))
}

/** Matches quotes/generate TierResult deposit math after pre-tax bump */
export type ScopedResidentialTier = {
  price: number
  deposit: number
  tax: number
  total: number
  includes: string[]
}

export type ScopedResidentialTiers = {
  essential: ScopedResidentialTier
  signature: ScopedResidentialTier
  estate: ScopedResidentialTier
}

function cfgNumLocal(map: Map<string, string>, key: string, fallback: number): number {
  const v = map.get(key)
  return v !== undefined && Number.isFinite(Number(v)) ? Number(v) : fallback
}

/** Apply flat multi-day scope dollars to all residential tiers after core engine pricing */
export function applyMoveScopeAddonToResidentialTiers(
  tiers: ScopedResidentialTiers,
  addonPreTax: number,
  config: Map<string, string>,
): ScopedResidentialTiers {
  if (!Number.isFinite(addonPreTax) || addonPreTax <= 0) return tiers

  const taxRate = cfgNumLocal(config, "tax_rate", 0.13)
  const rounding = cfgNumLocal(config, "rounding_nearest", 50)

  const curPct = cfgNumLocal(config, "deposit_essential_pct", cfgNumLocal(config, "deposit_curated_pct", 10))
  const curMin = cfgNumLocal(config, "deposit_essential_min", cfgNumLocal(config, "deposit_curated_min", 150))
  const sigPct = cfgNumLocal(config, "deposit_signature_pct", 15)
  const sigMin = cfgNumLocal(config, "deposit_signature_min", 250)
  const estPct = cfgNumLocal(config, "deposit_estate_pct", 25)
  const estMin = cfgNumLocal(config, "deposit_estate_min", 500)

  const bumpOne = (
    row: ScopedResidentialTier,
    pct: number,
    minDep: number,
  ): ScopedResidentialTier => {
    let price = row.price + addonPreTax
    price = Math.round(price / rounding) * rounding
    const tax = Math.round(price * taxRate)
    const total = price + tax
    const deposit = Math.max(minDep, Math.round((price * pct) / 100))
    return {
      ...row,
      price,
      tax,
      total,
      deposit,
    }
  }

  return {
    essential: bumpOne(tiers.essential, curPct, curMin),
    signature: bumpOne(tiers.signature, sigPct, sigMin),
    estate: bumpOne(tiers.estate, estPct, estMin),
  }
}
