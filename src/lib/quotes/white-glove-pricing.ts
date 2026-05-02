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
    return rows.map((r) => ({ ...r }))
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
  const distFree = cfgNum(config, "white_glove_dist_free_km", 15)
  const perKm = cfgNum(config, "white_glove_per_km", 4)
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
    distKm > distFree ? Math.round((distKm - distFree) * perKm * 100) / 100 : 0

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

/** Crew / hours hints for coordinator UI (not billed as labour line in item model). */
export function whiteGloveDisplayCrewHours(itemCount: number, distKm: number): {
  crew: number
  hours: number
} {
  const n = Math.max(1, itemCount)
  const crew = Math.min(8, Math.max(2, 2 + Math.floor(n / 5)))
  let hours = 2 + Math.min(6, n) * 0.35
  if (distKm > 25) hours += 0.5
  if (distKm > 45) hours += 0.5
  return {
    crew,
    hours: Math.max(2, Math.round(hours * 2) / 2),
  }
}
