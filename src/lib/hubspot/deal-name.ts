/**
 * HubSpot deal name builder.
 *
 * Format (using | separator):
 *   Residential: First Last | Tier | Size | City
 *   B2B:         [B2B] | Company | Vertical | City
 *   PM:          [PM] | Tenant | City
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

/** Extract the city segment from a full address string. */
function extractCity(address: string | null | undefined): string {
  if (!address) return ""
  const s = String(address).trim()
  // Typical format: "123 Street, City, Province ZIP" or "123 Street, City, State 12345"
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    // Second-to-last segment is generally city; last is state/province + zip
    const candidate = parts[parts.length - 2]
    // Strip trailing two-letter province/state code if present in this segment
    return candidate.replace(/\s+[A-Z]{2}\s*$/, "").trim()
  }
  return ""
}

/** Format a move-size slug for display. "2_bedroom" → "2 Bed", "studio" → "Studio". */
function formatSize(size: string | null | undefined): string {
  const s = String(size || "").trim()
  if (!s) return ""
  return s
    .replace(/_/g, " ")
    .replace(/\b(\d+)\s*bed(room)?s?\b/i, "$1 Bed")
    .replace(/\bstudio\b/i, "Studio")
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
  /** Move size / bedroom count — shown for residential deals (e.g. "2_bedroom"). */
  moveSize?: string | null
  /** Pickup / from address — city is extracted and appended to all deal names. */
  fromAddress?: string | null
  /** Legacy: kept for call-site compatibility but no longer included in the deal name. */
  date?: string | null
  fallbackCode?: string | null
}): string {
  const cat = serviceCategory(opts.serviceType, opts.isPmMove)
  const city = extractCity(opts.fromAddress)
  const label = serviceTypeHumanLabel(opts.serviceType)

  if (cat === "b2b") {
    const biz = String(opts.businessName || "").trim()
    const person = joinName(opts.firstName, opts.lastName)
    const subject = biz || person
    return assembleParts(["[B2B]", subject, label, city], opts.fallbackCode ?? "B2B Deal")
  }

  if (cat === "pm") {
    const tenant = joinName(opts.firstName, opts.lastName)
    return assembleParts(["[PM]", tenant, city], opts.fallbackCode ?? "PM Deal")
  }

  // residential
  const person = joinName(opts.firstName, opts.lastName)
  const tier = String(opts.tierLabel || "").trim()
  const size = formatSize(opts.moveSize)
  return assembleParts([person, tier || label, size, city], opts.fallbackCode ?? "Residential Deal")
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function assembleParts(parts: (string | null | undefined)[], fallback: string): string {
  const joined = parts
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .join(" | ")
  return (joined.trim() || fallback).slice(0, 200)
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
