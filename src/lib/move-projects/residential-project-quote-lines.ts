import { WIDGET_RESIDENTIAL_BASE_RATES } from "@/lib/pricing/widget-estimate"
import { cfgNum } from "@/lib/pricing/engine"

type PricingConfig = Map<string, string> | Record<string, string>
import { residentialInventoryLineScore } from "@/lib/pricing/weight-tiers"
import { getTruckFeeSync } from "@/lib/pricing/truck-fees"
import type { MoveProjectPayload } from "./schema"

export type ProjectQuoteLineItem = {
  description: string
  detail: string
  amount: number
}

export type ProjectQuoteBreakdown = {
  line_items: ProjectQuoteLineItem[]
  subtotal_pre_tax: number
  hst: number
  total_with_tax: number
  deposit: number
  payment_schedule: { milestone: string; amount: number; due?: string }[]
}

type Inv = {
  name?: string
  quantity: number
  weight_score?: number
  weight_tier_code?: string
}

function baseBand(moveSize: string | undefined): number {
  const k = (moveSize ?? "2br").trim()
  return WIDGET_RESIDENTIAL_BASE_RATES[k as keyof typeof WIDGET_RESIDENTIAL_BASE_RATES] ?? 999
}

function tierDisplay(t: string): string {
  const x = t.toLowerCase()
  if (x === "estate") return "Estate"
  if (x === "signature") return "Signature"
  if (x === "essential") return "Essential"
  return t
}

function tierMultiplierFromQuotes(
  recommendedTier: string,
  tiers: { essential: { price: number }; signature: { price: number }; estate: { price: number } },
  moveSize: string,
): number {
  const band = Math.max(1, baseBand(moveSize))
  const key = recommendedTier.toLowerCase() as "essential" | "signature" | "estate"
  const t = tiers[key] ?? tiers.signature
  return Math.max(0.5, t.price / band)
}

function specialtySurchargeEstimate(items: Inv[]): number {
  let n = 0
  for (const it of items) {
    const lineScore = residentialInventoryLineScore({
      weight_score: it.weight_score ?? 1,
      quantity: it.quantity,
      weight_tier_code: it.weight_tier_code,
    })
    const name = `${it.name ?? ""}`.toLowerCase()
    const heavy = lineScore > 8 || name.includes("piano") || name.includes("safe")
    if (heavy) n += 75 * Math.max(1, it.quantity)
  }
  return Math.min(2500, n)
}

function estimateMaterials(
  allItems: Inv[],
  tier: string,
  config: PricingConfig,
): number {
  const base = cfgNum(config, "project_packing_materials_base", 200)
  const per = cfgNum(config, "project_packing_materials_per_item", 4)
  const n = allItems.reduce((s, i) => s + i.quantity, 0)
  const mult = tier.toLowerCase() === "estate" ? 1.35 : tier.toLowerCase() === "signature" ? 1.15 : 1
  return Math.round((base + n * per) * mult)
}

/**
 * Coordinator-facing project line items for multi-stop residential quotes.
 * Aligns to tier pricing scale from the main quote engine for the primary move size.
 */
export function buildResidentialProjectQuoteBreakdown(args: {
  config: PricingConfig
  recommendedTier: string
  primaryMoveSize: string
  tiers: { essential: { price: number }; signature: { price: number }; estate: { price: number } }
  moveProject: MoveProjectPayload
  /** Flattened inventory rows, optional origin_index 0..n-1 */
  inventoryItems: (Inv & { origin_index?: number })[]
}): ProjectQuoteBreakdown {
  const { config, recommendedTier, primaryMoveSize, tiers, moveProject } = args
  const origins = moveProject.origins.length > 0 ? moveProject.origins : [{ address: "Origin" }]
  const destinations = moveProject.destinations.length > 0 ? moveProject.destinations : [{ address: "Destination" }]
  const tierMult = tierMultiplierFromQuotes(recommendedTier, tiers, primaryMoveSize)
  const tLabel = tierDisplay(recommendedTier)

  const line_items: ProjectQuoteLineItem[] = []

  const byOrigin: Inv[][] = origins.map(() => [])
  for (const row of args.inventoryItems) {
    const ox = typeof row.origin_index === "number" && row.origin_index >= 0 ? row.origin_index : 0
    if (!byOrigin[ox]) byOrigin[ox] = []
    byOrigin[ox]!.push(row)
  }

  origins.forEach((origin, idx) => {
    const inv = byOrigin[idx] ?? []
    const partial = origin.is_partial === true
    const ms = (origin.move_size ?? primaryMoveSize).trim()
    let originPrice: number
    if (partial) {
      const itemScore = inv.reduce(
        (s, it) =>
          s +
          residentialInventoryLineScore({
            weight_score: it.weight_score ?? 1,
            quantity: it.quantity,
            weight_tier_code: it.weight_tier_code,
          }),
        0,
      )
      originPrice = Math.round(itemScore * 25 * tierMult)
      originPrice = Math.max(originPrice, 400)
    } else {
      const baseRate = baseBand(ms)
      originPrice = Math.round(baseRate * tierMult)
    }
    const head = origin.label?.trim() || origin.address?.trim() || `Origin ${idx + 1}`
    line_items.push({
      description: `${tLabel} move at ${head}`,
      detail: partial ? "Partial (selected items only)" : `Full ${tierDisplay(ms)} move`,
      amount: originPrice,
    })
  })

  if (origins.length > 1) {
    const logisticsPremium = (origins.length - 1) * cfgNum(config, "multi_origin_premium", 400)
    line_items.push({
      description: "Multi-location coordination",
      detail: `${origins.length} pickups to ${destinations.length} drop-off${destinations.length === 1 ? "" : "s"}`,
      amount: logisticsPremium,
    })
  }

  const allItems = args.inventoryItems
  const spec = specialtySurchargeEstimate(allItems)
  if (spec > 0) {
    line_items.push({
      description: "Specialty handling (estimate)",
      detail: "Heavy, fragile, or complex pieces",
      amount: Math.round(spec),
    })
  }

  line_items.push({
    description: "Packing materials (estimate)",
    detail: "Boxes, wrap, blankets, wardrobe and specialty supplies",
    amount: estimateMaterials(allItems, recommendedTier, config),
  })

  const truckDays = moveProject.phases.reduce((s, p) => s + p.days.length, 0)
  if (truckDays > 1) {
    const primaryTruck =
      moveProject.phases[0]?.days[0]?.truck_type?.trim() || "26ft"
    const truckFee = getTruckFeeSync(primaryTruck, config)
    const additionalTruckDays = truckDays - 1
    if (additionalTruckDays > 0 && truckFee > 0) {
      line_items.push({
        description: `Additional truck days (${additionalTruckDays})`,
        detail: `${primaryTruck} truck`,
        amount: Math.round(additionalTruckDays * truckFee),
      })
    }
  }

  const subtotal_pre_tax = line_items.reduce((s, x) => s + x.amount, 0)
  const hst = Math.round(subtotal_pre_tax * 0.13 * 100) / 100
  const total_with_tax = Math.round((subtotal_pre_tax + hst) * 100) / 100

  const depositPct = recommendedTier.toLowerCase() === "estate" ? 0.5 : 0.25
  const deposit = Math.round(subtotal_pre_tax * depositPct * 100) / 100
  const balance = Math.round((subtotal_pre_tax - deposit) * 100) / 100

  const payment_schedule =
    total_with_tax > 5000
      ? [
          {
            milestone: `${Math.round(depositPct * 100)}% deposit`,
            amount: deposit,
            due: "At booking",
          },
          { milestone: "Balance (pre-tax)", amount: balance, due: "48 hours before day 1" },
        ]
      : [
          { milestone: "Deposit", amount: deposit, due: "At booking" },
          {
            milestone: "Balance (pre-tax)",
            amount: balance,
            due: "48 hours before move day",
          },
        ]

  return {
    line_items,
    subtotal_pre_tax,
    hst,
    total_with_tax,
    deposit,
    payment_schedule,
  }
}
