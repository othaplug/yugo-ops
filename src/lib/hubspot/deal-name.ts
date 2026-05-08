/**
 * HubSpot deal name builder.
 *
 * Structured format by service category:
 *   B2B:         [B2B] CompanyName · Service Label · Date
 *   PM:          [PM] TenantName · Portfolio Move · Date
 *   Residential: FirstName LastName · Tier · Date
 *
 * Result is capped at 200 characters (HubSpot limit).
 */

import { SERVICE_TYPE_LABELS } from "@/lib/displayLabels"

/** Service type slugs that indicate a B2B (commercial) context. */
const B2B_SERVICE_TYPE_SET = new Set([
  "office_move",
  "office",
  "b2b_delivery",
  "b2b_oneoff",
  "b2b_one_off",
  "b2b_one_off_delivery",
  "b2b_day_rate_delivery",
  "commercial_delivery",
  "single_item",
  "labour_only",
])

export type ServiceCategory = "b2b" | "pm" | "residential"

/**
 * Classify a service type (and optional PM flag) into a broad deal category.
 * B2B types: office moves, all b2b_* slugs, single_item, labour_only.
 * PM: moves flagged with is_pm_move.
 * Residential: local_move, long_distance, white_glove, specialty, event, bin_rental.
 */
export function serviceCategory(
  serviceType: string | null | undefined,
  isPmMove?: boolean | null,
): ServiceCategory {
  if (isPmMove) return "pm"
  const st = String(serviceType || "")
    .trim()
    .toLowerCase()
  if (B2B_SERVICE_TYPE_SET.has(st) || st.startsWith("b2b_")) return "b2b"
  return "residential"
}

/** Build a structured HubSpot deal name. */
export function buildHubSpotDealName(opts: {
  serviceType?: string | null
  isPmMove?: boolean | null
  firstName?: string | null
  lastName?: string | null
  /** Company / organisation name — used as the primary subject for B2B deals. */
  businessName?: string | null
  /** Residential tier label (signature / curated / essential). Only shown for residential deals. */
  tierLabel?: string | null
  date?: string | null
  fallbackCode?: string | null
}): string {
  const cat = serviceCategory(opts.serviceType, opts.isPmMove)
  const date = String(opts.date || "").trim()
  const label = serviceTypeHumanLabel(opts.serviceType)

  if (cat === "b2b") {
    const biz = String(opts.businessName || "").trim()
    const person = joinName(opts.firstName, opts.lastName)
    const subject = biz || person
    return assembleName("[B2B]", subject, label, date, opts.fallbackCode ?? "B2B Deal")
  }

  if (cat === "pm") {
    const tenant = joinName(opts.firstName, opts.lastName)
    return assembleName("[PM]", tenant, label || "Portfolio Move", date, opts.fallbackCode ?? "PM Deal")
  }

  // residential
  const person = joinName(opts.firstName, opts.lastName)
  const tier = String(opts.tierLabel || "").trim()
  const display = tier || label
  return assembleName(null, person, display, date, opts.fallbackCode ?? "Residential Deal")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assembleName(
  prefix: string | null,
  subject: string,
  label: string,
  date: string,
  fallback: string,
): string {
  const parts = [prefix, subject, label, date]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
  return (parts.join(" · ").trim() || fallback).slice(0, 200)
}

function joinName(first?: string | null, last?: string | null): string {
  return [first, last]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(" ")
}

function serviceTypeHumanLabel(serviceType: string | null | undefined): string {
  const st = String(serviceType || "").trim()
  if (!st) return ""
  return (
    SERVICE_TYPE_LABELS[st] ??
    st.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
