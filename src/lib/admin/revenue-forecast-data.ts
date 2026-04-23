import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { getConfig } from "@/lib/config"
import { addCalendarDaysYmd, getTodayString } from "@/lib/business-timezone"
import {
  deliveryForecastRevenue,
  moveForecastRevenue,
  quotePipelineListedValue,
} from "@/lib/finance/revenue-forecast-amounts"
import type { RevenueForecastPayload } from "./revenue-forecast-types"

export type { RevenueForecastPayload, RevenueForecastPeriod } from "./revenue-forecast-types"

/** Booked / in-flight moves (scheduled in window or awaiting schedule). */
const MOVE_FORECAST_STATUSES = [
  "confirmed",
  "scheduled",
  "in_progress",
  "paid",
  "confirmed_pending_schedule",
  "confirmed_unassigned",
] as const

const MOVE_UNSCHEDULED_STATUSES = ["confirmed_pending_schedule", "confirmed_unassigned"] as const

/** Booked B2B deliveries in the forecast window (excludes pending approval / terminal states). */
const DELIVERY_FORECAST_STATUSES = [
  "confirmed",
  "scheduled",
  "approved",
  "in_progress",
  "dispatched",
  "in_transit",
  "in-transit",
] as const

const QUOTE_PIPELINE_STATUSES = ["sent", "viewed", "reactivated"] as const

type PipelineQuoteRow = {
  id: string
  move_date?: string | null
  expires_at?: string | null
  essential_price?: unknown
  custom_price?: unknown
  override_price?: unknown
  system_price?: unknown
  tiers?: unknown
}

const mergeMovesById = <T extends { id: string }>(a: T[], b: T[]): T[] => {
  const m = new Map<string, T>()
  for (const x of a) m.set(String(x.id), x)
  for (const x of b) m.set(String(x.id), x)
  return [...m.values()]
}

const quoteInPipelineWindow = (q: PipelineQuoteRow, todayStr: string, endStr: string): boolean => {
  const raw = q.move_date
  const md = raw != null && String(raw).length >= 10 ? String(raw).slice(0, 10) : null
  if (md) {
    if (md < todayStr) return false
    return md >= todayStr && md <= endStr
  }
  return true
}

/**
 * Forward revenue forecast from live Supabase (same logic as /api/admin/finance/revenue-forecast).
 * Used by the admin dashboard and API so numbers stay in sync with Ops+ data.
 */
export const loadRevenueForecastData = async (): Promise<RevenueForecastPayload> => {
  const supabase = createAdminClient()
  const todayStr = getTodayString()
  const conversionRateStr = await getConfig("quote_conversion_rate", "0.35")
  const conversionRate = parseFloat(conversionRateStr) || 0.35

  const { data: pipelineQuotesRaw, error: quotesFetchErr } = await supabase
    .from("quotes")
    .select(
      "id, essential_price, custom_price, override_price, system_price, tiers, status, move_date, expires_at, created_at",
    )
    .in("status", [...QUOTE_PIPELINE_STATUSES])

  if (quotesFetchErr) console.error("[revenue-forecast] quotes fetch:", quotesFetchErr.message)

  const nowMs = Date.now()
  const pipelinePool = ((pipelineQuotesRaw ?? []) as PipelineQuoteRow[]).filter((q) => {
    if (!q.expires_at) return true
    const t = new Date(q.expires_at).getTime()
    return !Number.isNaN(t) && t > nowMs
  })

  const periods = [7, 14, 30] as const
  const forecasts = await Promise.all(
    periods.map(async (days) => {
      const endStr = addCalendarDaysYmd(todayStr, days)

      const [scheduledMovesRes, unscheduledMovesRes, deliveriesRes] = await Promise.all([
        supabase
          .from("moves")
          .select(
            "id, final_amount, total_price, estimate, amount, deposit_amount, balance_amount, status, scheduled_date",
          )
          .in("status", [...MOVE_FORECAST_STATUSES])
          .gte("scheduled_date", todayStr)
          .lte("scheduled_date", endStr)
          .not("scheduled_date", "is", null),
        supabase
          .from("moves")
          .select(
            "id, final_amount, total_price, estimate, amount, deposit_amount, balance_amount, status, scheduled_date",
          )
          .in("status", [...MOVE_UNSCHEDULED_STATUSES])
          .is("scheduled_date", null),
        supabase
          .from("deliveries")
          .select(
            "id, final_price, admin_adjusted_price, override_price, total_price, quoted_price, calculated_price, status, scheduled_date",
          )
          .in("status", [...DELIVERY_FORECAST_STATUSES])
          .gte("scheduled_date", todayStr)
          .lte("scheduled_date", endStr)
          .not("scheduled_date", "is", null),
      ])

      if (scheduledMovesRes.error) {
        console.error("[revenue-forecast] moves (scheduled):", scheduledMovesRes.error.message)
      }
      if (unscheduledMovesRes.error) {
        console.error("[revenue-forecast] moves (unscheduled):", unscheduledMovesRes.error.message)
      }
      if (deliveriesRes.error) {
        console.error("[revenue-forecast] deliveries:", deliveriesRes.error.message)
      }

      const confirmedMoves = mergeMovesById(
        scheduledMovesRes.data ?? [],
        unscheduledMovesRes.data ?? [],
      )
      const confirmedDeliveries = deliveriesRes.data ?? []

      const pipelineQuotes = pipelinePool.filter((q) => quoteInPipelineWindow(q, todayStr, endStr))

      const confirmedRevenue =
        confirmedMoves.reduce((s, m) => s + moveForecastRevenue(m), 0) +
        confirmedDeliveries.reduce((s, d) => s + deliveryForecastRevenue(d), 0)

      const pipelineListed = pipelineQuotes.reduce((s, q) => s + quotePipelineListedValue(q), 0)
      const pipelineRevenue = Math.round(pipelineListed * conversionRate)

      return { days, confirmedRevenue, pipelineRevenue, quoteCount: pipelineQuotes.length }
    }),
  )

  return { forecasts, conversionRate }
}
