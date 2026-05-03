/**
 * White Glove (curated delivery) item-based pricing.
 * Used by quote generate API and client-side preview; keep free of Next/HTTP imports.
 */

import { getTruckFeeSync } from "@/lib/pricing/truck-fees";

export type WhiteGloveItemCategory =
  | "small"
  | "medium"
  | "large"
  | "heavy_appliance"
  | "extra_heavy"
  | "fragile";

export type WhiteGloveWeightClass =
  | "under_50"
  | "50_150"
  | "150_300"
  | "300_500"
  | "over_500";

export type WhiteGloveAssembly =
  | "none"
  | "disassembly"
  | "assembly"
  | "both";

export type WhiteGloveItemInput = {
  description?: string
  quantity?: number
  category?: string
  weight_class?: string
  assembly?: string
  is_fragile?: boolean
  is_high_value?: boolean
  notes?: string
  /** item_weights.slug when line came from the catalog */
  slug?: string
  /** True when coordinator entered manually (not from item_weights) */
  is_custom?: boolean
}

/** Minimal row from item_weights for browse / paste */
export type WhiteGloveItemWeightSource = {
  slug: string
  item_name: string
  weight_score: number
  category?: string
  room?: string
  active?: boolean
}

export const WHITE_GLOVE_BROWSE_TABS = [
  { key: "living", label: "Living Room" },
  { key: "bedroom", label: "Bedroom" },
  { key: "dining", label: "Dining" },
  { key: "office", label: "Office" },
  { key: "electronics", label: "Electronics" },
  { key: "appliances", label: "Appliances" },
  { key: "decor", label: "Art / Decor" },
  { key: "all", label: "All" },
] as const

export type WhiteGloveBrowseTabKey = (typeof WHITE_GLOVE_BROWSE_TABS)[number]["key"]

export function mapWeightScoreToWhiteGloveCategory(weightScore: number): WhiteGloveItemCategory {
  const s = Number(weightScore)
  if (!Number.isFinite(s) || s <= 0) return "medium"
  if (s <= 0.5) return "small"
  if (s <= 1.0) return "medium"
  if (s <= 2.0) return "large"
  return "extra_heavy"
}

export function mapWeightScoreToWhiteGloveWeightClass(weightScore: number): WhiteGloveWeightClass {
  const s = Number(weightScore)
  if (!Number.isFinite(s) || s <= 0) return "50_150"
  if (s <= 0.5) return "under_50"
  if (s <= 1.0) return "50_150"
  if (s <= 2.0) return "150_300"
  return "300_500"
}

/** Kitchen slugs that should map to heavy_appliance instead of extra_heavy */
const WG_APPLIANCE_SLUG_HINTS =
  /refrigerator|stove-range|dishwasher|washer|dryer|freezer|microwave/

export function whiteGloveDefaultsFromItemWeight(row: WhiteGloveItemWeightSource): {
  description: string
  category: WhiteGloveItemCategory
  weight_class: WhiteGloveWeightClass
  is_fragile: boolean
  slug: string
  is_custom: false
} {
  const ws = Number(row.weight_score)
  let category = mapWeightScoreToWhiteGloveCategory(ws)
  if (category === "extra_heavy" && WG_APPLIANCE_SLUG_HINTS.test(row.slug)) {
    category = "heavy_appliance"
  }
  const slugLower = row.slug.toLowerCase()
  const nameLower = row.item_name.toLowerCase()
  const fragileFromName =
    /tv|television|glass|mirror|crystal|artwork|framed|marble|aquarium|sculpture|porcelain|antique/i.test(
      nameLower + " " + slugLower,
    )
  return {
    description: row.item_name.trim(),
    category: fragileFromName && category !== "extra_heavy" ? "fragile" : category,
    weight_class: mapWeightScoreToWhiteGloveWeightClass(ws),
    is_fragile: fragileFromName,
    slug: row.slug,
    is_custom: false,
  }
}

export function itemWeightMatchesWhiteGloveTab(
  w: WhiteGloveItemWeightSource,
  tab: WhiteGloveBrowseTabKey,
): boolean {
  if (tab === "all") return true
  const room = (w.room || "other").toLowerCase()
  const slug = w.slug.toLowerCase()
  const cat = (w.category || "").toLowerCase()
  if (tab === "living") return room === "living_room"
  if (tab === "bedroom") return room === "bedroom"
  if (tab === "dining") return room === "dining_room"
  if (tab === "office") return room === "office"
  if (tab === "electronics") {
    return (
      slug.includes("tv") ||
      slug.includes("monitor") ||
      slug.includes("printer") ||
      slug.includes("computer") ||
      (slug.includes("speaker") && !slug.includes("bookshelf"))
    )
  }
  if (tab === "appliances") {
    return (
      room === "kitchen" ||
      WG_APPLIANCE_SLUG_HINTS.test(slug) ||
      cat === "appliance"
    )
  }
  if (tab === "decor") {
    return (
      slug.includes("lamp") ||
      slug.includes("mirror") ||
      slug.includes("rug") ||
      slug.includes("artwork") ||
      slug.includes("sculpture") ||
      slug.includes("curio") ||
      slug.includes("cabinet-hutch") ||
      room === "specialty"
    )
  }
  return false
}

export const WG_ITEM_CATEGORIES: {
  value: WhiteGloveItemCategory
  label: string
  description: string
}[] = [
  { value: "small", label: "Small / light", description: "Lamp, side table, small box, decor" },
  { value: "medium", label: "Medium", description: "Dresser, bookshelf, desk, nightstand" },
  { value: "large", label: "Large", description: "Sofa, dining table, bed frame, sectional" },
  {
    value: "heavy_appliance",
    label: "Heavy appliance",
    description: "Fridge, washer, dryer, range",
  },
  { value: "extra_heavy", label: "Extra heavy", description: "Piano, safe, pool table, marble" },
  { value: "fragile", label: "Fragile / art", description: "Artwork, antiques, glass, sculpture" },
]

export const WG_WEIGHT_CLASS_OPTIONS: { value: WhiteGloveWeightClass; label: string }[] = [
  { value: "under_50", label: "Under 50 lbs" },
  { value: "50_150", label: "50–150 lbs" },
  { value: "150_300", label: "150–300 lbs" },
  { value: "300_500", label: "300–500 lbs" },
  { value: "over_500", label: "Over 500 lbs" },
]

export const WG_ASSEMBLY_OPTIONS: { value: WhiteGloveAssembly; label: string }[] = [
  { value: "none", label: "None" },
  { value: "disassembly", label: "Disassembly at pickup" },
  { value: "assembly", label: "Assembly at delivery" },
  { value: "both", label: "Both (disassemble + reassemble)" },
]

export const WG_QUICK_ADD: Record<
  string,
  {
    category: WhiteGloveItemCategory
    weight: WhiteGloveWeightClass
    assembly: WhiteGloveAssembly
    is_fragile?: boolean
    is_high_value?: boolean
    description: string
  }
> = {
  Sofa: {
    description: "Sofa",
    category: "large",
    weight: "150_300",
    assembly: "none",
  },
  "Bed frame": {
    description: "Bed frame",
    category: "large",
    weight: "150_300",
    assembly: "assembly",
  },
  Mattress: {
    description: "Mattress",
    category: "large",
    weight: "150_300",
    assembly: "none",
  },
  Dresser: {
    description: "Dresser",
    category: "medium",
    weight: "50_150",
    assembly: "none",
  },
  TV: {
    description: "TV",
    category: "fragile",
    weight: "50_150",
    assembly: "none",
    is_fragile: true,
  },
  Table: {
    description: "Table",
    category: "large",
    weight: "150_300",
    assembly: "none",
  },
  "Chair set": {
    description: "Chair set",
    category: "medium",
    weight: "50_150",
    assembly: "none",
  },
  Mirror: {
    description: "Mirror",
    category: "fragile",
    weight: "under_50",
    assembly: "none",
    is_fragile: true,
  },
  Artwork: {
    description: "Artwork",
    category: "fragile",
    weight: "under_50",
    assembly: "none",
    is_fragile: true,
    is_high_value: true,
  },
}

function cfgNum(config: Map<string, string>, key: string, fallback: number): number {
  const v = config.get(key)
  if (v === undefined || v === "") return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const DEFAULT_CATEGORY_RATES: Record<WhiteGloveItemCategory, number> = {
  small: 35,
  medium: 65,
  large: 120,
  heavy_appliance: 150,
  extra_heavy: 250,
  fragile: 95,
}

const DEFAULT_WEIGHT_SURCHARGE_PCT: Record<WhiteGloveWeightClass, number> = {
  under_50: 0,
  "50_150": 0,
  "150_300": 15,
  "300_500": 35,
  over_500: 75,
}

function categoryRate(config: Map<string, string>, cat: string): number {
  const key = `white_glove_rate_${cat}` as const
  const n = cfgNum(config, key, NaN)
  if (Number.isFinite(n) && n >= 0) return n
  const d = DEFAULT_CATEGORY_RATES[cat as WhiteGloveItemCategory]
  return d ?? 65
}

function weightMult(config: Map<string, string>, wc: string): number {
  const pctKey = `white_glove_weight_pct_${wc}`
  const fromCfg = config.get(pctKey)
  let pct: number
  if (fromCfg !== undefined && Number.isFinite(Number(fromCfg))) {
    pct = Number(fromCfg)
  } else {
    pct = DEFAULT_WEIGHT_SURCHARGE_PCT[wc as WhiteGloveWeightClass] ?? 0
  }
  return 1 + pct / 100
}

function assemblyLinePerItem(
  config: Map<string, string>,
  assembly: string,
  qty: number,
): { amount: number; label: string } {
  const a = (assembly || "none").toLowerCase() as WhiteGloveAssembly
  const q = Math.max(1, qty)
  if (a === "assembly") {
    return { amount: cfgNum(config, "white_glove_assembly_rate", 45) * q, label: "assembly" }
  }
  if (a === "disassembly") {
    return {
      amount: cfgNum(config, "white_glove_disassembly_rate", 35) * q,
      label: "disassembly",
    }
  }
  if (a === "both") {
    return {
      amount: cfgNum(config, "white_glove_both_assembly_rate", 70) * q,
      label: "both",
    }
  }
  return { amount: 0, label: "none" }
}

/** Map legacy single-item / old quote categories to WG buckets. */
export function mapLegacyItemCategoryToWhiteGlove(category: string | undefined): WhiteGloveItemCategory {
  const c = (category || "").toLowerCase()
  if (c.includes("small_light") || c === "small") return "small"
  if (c.includes("standard") || c.includes("medium")) return "medium"
  if (c.includes("large_heavy") || c === "large") return "large"
  if (c.includes("appliance") || c.includes("heavy_appliance")) return "heavy_appliance"
  if (c.includes("oversized") || c.includes("extra_heavy")) return "extra_heavy"
  if (c.includes("fragile") || c.includes("specialty")) return "fragile"
  if (c.includes("multiple")) return "medium"
  return "medium"
}

function mapLegacyWeightToClass(weightLabel: string | undefined): WhiteGloveWeightClass {
  const w = (weightLabel || "").toLowerCase()
  if (w.includes("under 50")) return "under_50"
  if (w.includes("50") && w.includes("150")) return "50_150"
  if (w.includes("150") && w.includes("300")) return "150_300"
  if (w.includes("300") && w.includes("500")) return "300_500"
  if (w.includes("over 500")) return "over_500"
  return "50_150"
}

export function mapLegacyAssemblyToWhiteGlove(assembly: string | undefined): WhiteGloveAssembly {
  const a = (assembly || "none").toLowerCase()
  if (a.includes("both")) return "both"
  if (a.includes("disassembly") && a.includes("pickup")) return "disassembly"
  if (a.includes("assembly") && a.includes("delivery")) return "assembly"
  if (a.includes("disassembly")) return "disassembly"
  if (a.includes("assembly")) return "assembly"
  return "none"
}

export function normalizeWhiteGloveItemsFromQuoteInput(input: {
  white_glove_items?: WhiteGloveItemInput[] | null
  item_description?: string | null
  item_category?: string | null
  item_weight_class?: string | null
  assembly_needed?: string | null
  number_of_items?: number | null
  declared_value?: number | null
}): WhiteGloveItemInput[] {
  const rows = input.white_glove_items
  if (Array.isArray(rows) && rows.length > 0) {
    return rows.map((r) => ({
      ...r,
      slug: typeof r.slug === "string" && r.slug.trim() ? r.slug.trim() : undefined,
      is_custom: r.is_custom === true,
    }))
  }
  const desc = (input.item_description || "").trim()
  if (!desc) return []
  const qty = Math.max(1, Number(input.number_of_items) || 1)
  return [
    {
      description: desc,
      quantity: qty,
      category: mapLegacyItemCategoryToWhiteGlove(input.item_category ?? undefined),
      weight_class: mapLegacyWeightToClass(input.item_weight_class ?? undefined),
      assembly: mapLegacyAssemblyToWhiteGlove(input.assembly_needed ?? undefined),
      is_fragile:
        mapLegacyItemCategoryToWhiteGlove(input.item_category ?? undefined) === "fragile",
      is_high_value: (input.declared_value ?? 0) >= 5000,
      notes: "",
    },
  ]
}

export type WhiteGlovePricedLine = {
  description: string
  quantity: number
  category: string
  categoryLabel: string
  itemSubtotal: number
  assemblyAmount: number
  assemblyNote: string | null
}

export type WhiteGlovePricingBreakdown = {
  /** max(baseRate, sum of item line bases after weight mult) */
  itemsOrMinimum: number
  itemLines: WhiteGlovePricedLine[]
  assemblyTotal: number
  accessTotal: number
  distanceSurcharge: number
  debrisFee: number
  declaredValuePremium: number
  guaranteedWindowFee: number
  truckSurcharge: number
  subtotalBeforeRound: number
  /** after rounding_nearest */
  subtotalPreTax: number
}

function categoryLabel(cat: string): string {
  return WG_ITEM_CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

/** Distance surcharge: prefer white_glove_free_radius_km / white_glove_distance_rate when present in config. */
function whiteGloveDistanceChargeParams(config: Map<string, string>): {
  distFreeKm: number
  perKm: number
} {
  const hasFreeRadius =
    config.has("white_glove_free_radius_km") &&
    String(config.get("white_glove_free_radius_km") ?? "").trim() !== ""
  const distFreeKm = hasFreeRadius
    ? cfgNum(config, "white_glove_free_radius_km", 50)
    : cfgNum(config, "white_glove_dist_free_km", 50)
  const hasDistRate =
    config.has("white_glove_distance_rate") &&
    String(config.get("white_glove_distance_rate") ?? "").trim() !== ""
  const perKm = hasDistRate
    ? cfgNum(config, "white_glove_distance_rate", 2)
    : cfgNum(config, "white_glove_per_km", 2)
  return { distFreeKm, perKm }
}

export function computeWhiteGlovePricingBreakdown(
  config: Map<string, string>,
  itemsIn: WhiteGloveItemInput[],
  opts: {
    distKm: number
    fromAccessCharge: number
    toAccessCharge: number
    parkingLongCarryTotal: number
    declaredValue?: number
    debrisRemoval?: boolean
    guaranteedNarrowWindowhours?: number | null
    truckType?: string
  },
): WhiteGlovePricingBreakdown {
  const baseRate = cfgNum(config, "white_glove_base_rate", 199)
  const distKm = Math.max(0, opts.distKm)
  const { distFreeKm, perKm } = whiteGloveDistanceChargeParams(config)
  const debrisFee =
    opts.debrisRemoval === true
      ? cfgNum(config, "white_glove_debris_removal_fee", 50)
      : 0

  const wgDvThreshold = cfgNum(config, "white_glove_declared_value_threshold", 5000)
  const wgDvPremium = cfgNum(config, "white_glove_declared_value_premium", 50)
  const dvPrem = (opts.declaredValue ?? 0) > wgDvThreshold ? wgDvPremium : 0

  let guaranteedWindowFee = 0
  const gwHours = opts.guaranteedNarrowWindowhours
  if (gwHours != null && gwHours > 0) {
    guaranteedWindowFee = cfgNum(config, "white_glove_guaranteed_window_fee", 75)
  }

  const itemLines: WhiteGlovePricedLine[] = []
  let rawItemSum = 0
  let assemblyTotal = 0

  for (const raw of itemsIn) {
    const desc = (raw.description || "").trim()
    if (!desc) continue
    const qty = Math.max(1, Math.min(99, Number(raw.quantity) || 1))
    const cat = (raw.category || "medium").toLowerCase() as WhiteGloveItemCategory
    const wc = (raw.weight_class || "50_150").toLowerCase() as WhiteGloveWeightClass
    const baseItem = categoryRate(config, cat)
    const mult = weightMult(config, wc)
    const lineBase = baseItem * mult * qty
    rawItemSum += lineBase

    const asm = assemblyLinePerItem(config, raw.assembly || "none", qty)
    assemblyTotal += asm.amount

    itemLines.push({
      description: desc,
      quantity: qty,
      category: cat,
      categoryLabel: categoryLabel(cat),
      itemSubtotal: Math.round(lineBase * 100) / 100,
      assemblyAmount: Math.round(asm.amount * 100) / 100,
      assemblyNote:
        asm.amount > 0 ? (asm.label === "both" ? "both" : asm.label) : null,
    })
  }

  const itemsOrMinimum = Math.max(baseRate, Math.round(rawItemSum * 100) / 100)
  const accessTotal =
    opts.fromAccessCharge + opts.toAccessCharge + opts.parkingLongCarryTotal

  const distanceSurcharge =
    distKm > distFreeKm
      ? Math.round((distKm - distFreeKm) * perKm * 100) / 100
      : 0

  const truckT = (opts.truckType || "sprinter").toLowerCase()
  const truckSurcharge =
    truckT === "none" ? 0 : Math.round(getTruckFeeSync(truckT, config) * 100) / 100

  const subtotalBeforeRound =
    itemsOrMinimum +
    assemblyTotal +
    accessTotal +
    distanceSurcharge +
    debrisFee +
    dvPrem +
    guaranteedWindowFee +
    truckSurcharge

  const rounding = cfgNum(config, "rounding_nearest", 50)
  const roundTo = (n: number, step: number) =>
    step > 0 ? Math.round(n / step) * step : n
  const subtotalPreTax = roundTo(subtotalBeforeRound, rounding)

  return {
    itemsOrMinimum,
    itemLines,
    assemblyTotal: Math.round(assemblyTotal * 100) / 100,
    accessTotal: Math.round(accessTotal * 100) / 100,
    distanceSurcharge,
    debrisFee,
    declaredValuePremium: dvPrem,
    guaranteedWindowFee,
    truckSurcharge,
    subtotalBeforeRound,
    subtotalPreTax,
  }
}

/** Category load minutes per unit (handling only; assembly time is estimated separately for hours). */
const WG_LOAD_MINUTES_PER_UNIT: Record<WhiteGloveItemCategory, number> = {
  small: 5,
  medium: 10,
  large: 15,
  heavy_appliance: 20,
  extra_heavy: 30,
  fragile: 15,
}

const WG_ASSEMBLY_MINUTES_PER_UNIT: Record<WhiteGloveAssembly, number> = {
  none: 0,
  disassembly: 20,
  assembly: 25,
  both: 40,
}

const WG_CATEGORY_VALUE_SET = new Set(WG_ITEM_CATEGORIES.map((c) => c.value))

function coerceWhiteGloveItemCategory(row: WhiteGloveItemInput): WhiteGloveItemCategory {
  const raw = String(row.category ?? "").trim().toLowerCase()
  if (WG_CATEGORY_VALUE_SET.has(raw as WhiteGloveItemCategory))
    return raw as WhiteGloveItemCategory
  return mapLegacyItemCategoryToWhiteGlove(row.category)
}

function whiteGloveRowLoadMinutes(row: WhiteGloveItemInput): number {
  const qty = Math.max(1, Math.min(99, Number(row.quantity) || 1))
  const cat = coerceWhiteGloveItemCategory(row)
  let perUnit = WG_LOAD_MINUTES_PER_UNIT[cat]
  if (row.is_fragile === true && cat !== "fragile") perUnit += 4
  return qty * perUnit
}

export function whiteGloveTotalLoadMinutes(items: WhiteGloveItemInput[]): number {
  let total = 0
  for (const row of items) {
    if (!(row.description || "").trim()) continue
    total += whiteGloveRowLoadMinutes(row)
  }
  return total
}

/**
 * White Glove crew: item volume and true extra-heavy scope only.
 * Assembly line count must not bump crew (that inflated hours and implied rates).
 */
export function recommendWhiteGloveCrew(items: WhiteGloveItemInput[]): number {
  let crew = 2
  let heavyCount = 0
  let totalItems = 0
  let hasExtraHeavy = false

  for (const row of items) {
    if (!(row.description || "").trim()) continue
    const qty = Math.max(1, Math.min(99, Number(row.quantity) || 1))
    totalItems += qty
    const cat = coerceWhiteGloveItemCategory(row)
    const wc = String(row.weight_class ?? "").toLowerCase()
    if (cat === "extra_heavy" || wc === "over_500" || wc.includes("over_500")) {
      hasExtraHeavy = true
    }
    if (cat === "large" || cat === "heavy_appliance" || cat === "extra_heavy") {
      heavyCount += qty
    }
  }

  if (heavyCount >= 5 || hasExtraHeavy) crew = 3
  if (totalItems >= 15 && heavyCount >= 8) crew = 4

  return Math.min(8, crew)
}

const WG_HOURS_CREW_LOAD_MODIFIER: Record<number, number> = {
  1: 1.5,
  2: 1.0,
  3: 0.78,
  4: 0.62,
}

/**
 * Wall-clock hours: load, drive, unload (crew-scaled), assembly (not crew-scaled), debris.
 * Prefer Mapbox drive minutes when provided.
 */
export function estimateWhiteGloveHours(
  items: WhiteGloveItemInput[],
  distKm: number,
  crewSize: number,
  driveTimeMinutes?: number | null,
): number {
  let loadMinutes = 0
  let assemblyMinutes = 0

  for (const row of items) {
    if (!(row.description || "").trim()) continue
    const qty = Math.max(1, Math.min(99, Number(row.quantity) || 1))
    loadMinutes += whiteGloveRowLoadMinutes(row)
    const asm = mapLegacyAssemblyToWhiteGlove(row.assembly)
    assemblyMinutes += (WG_ASSEMBLY_MINUTES_PER_UNIT[asm] ?? 0) * qty
  }

  const driveMinutes =
    driveTimeMinutes != null &&
    Number.isFinite(driveTimeMinutes) &&
    driveTimeMinutes > 0
      ? driveTimeMinutes
      : Math.max(0, distKm) * 2

  const unloadMinutes = loadMinutes * 0.85
  const debrisMinutes = 15

  const crew = Math.max(1, Math.min(8, Math.round(crewSize)))
  const hourMod = WG_HOURS_CREW_LOAD_MODIFIER[crew] ?? 1

  const totalMinutes =
    loadMinutes * hourMod +
    driveMinutes +
    unloadMinutes * hourMod +
    assemblyMinutes +
    debrisMinutes

  const hours = Math.round(totalMinutes / 30) / 2
  return Math.max(2, hours)
}

export type WhiteGloveClientInclusionInput = {
  items: WhiteGloveItemInput[]
  assemblyTotal: number
  debrisRemoval: boolean
  debrisFee: number
  guaranteedWindowHours: number | null
  truckDisplay: string
  crew: number
  hours: number
  distKm: number
}

/** Client-facing inclusion bullets from actual scope (fallback to DB tier features when this returns empty). */
export function getWhiteGloveClientInclusions(input: WhiteGloveClientInclusionInput): string[] {
  const items = input.items.filter((i) => (i.description || "").trim())
  if (items.length === 0) return []

  const itemCount = items.reduce(
    (s, i) => s + Math.max(1, Math.min(99, Number(i.quantity) || 1)),
    0,
  )
  const lines: string[] = []
  lines.push(
    itemCount === 1
      ? "White glove handling for 1 quoted item"
      : `White glove handling for ${itemCount} quoted items`,
  )

  let assemblyLines = 0
  for (const row of items) {
    const asm = String(row.assembly ?? "none").toLowerCase()
    if (asm !== "none" && asm !== "") {
      assemblyLines += Math.max(1, Math.min(99, Number(row.quantity) || 1))
    }
  }
  if (assemblyLines > 0) {
    lines.push(
      assemblyLines === 1
        ? "Assembly or disassembly on 1 line item"
        : `Assembly or disassembly on ${assemblyLines} line items`,
    )
  } else if (input.assemblyTotal > 0) {
    lines.push("Assembly or disassembly (quoted)")
  }

  if (input.debrisRemoval && input.debrisFee > 0) {
    lines.push("Debris removal at delivery")
  }

  if (
    typeof input.guaranteedWindowHours === "number" &&
    Number.isFinite(input.guaranteedWindowHours) &&
    input.guaranteedWindowHours > 0
  ) {
    lines.push(
      `Guaranteed ${input.guaranteedWindowHours}-hour arrival window (quoted add-on)`,
    )
  }

  lines.push(
    `${input.crew}-person crew, about ${input.hours} hours on site (estimate)`,
  )

  const truckLine = input.truckDisplay.trim()
  if (truckLine) lines.push(`Vehicle: ${truckLine}`)

  if (input.distKm > 0) {
    lines.push(`Route distance about ${Math.round(input.distKm)} km`)
  }

  lines.push("Blanket and pad wrapping in transit")
  lines.push("Floor and entryway protection as needed")

  return lines
}
