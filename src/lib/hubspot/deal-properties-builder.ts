/**
 * THE SINGLE SOURCE OF TRUTH for the yugo_* custom properties on every HubSpot deal.
 *
 * Both auto-create-deal-for-quote.ts and auto-create-deal-for-move.ts spread
 * `buildAllYugoProperties(record)` into their property payloads. Going forward,
 * any new deal create/update call MUST go through this builder — never inline.
 *
 * The list of property names MUST stay in sync with `YUGO_CUSTOM_PROPS` in setup.ts.
 */

import { serviceCategory } from "@/lib/hubspot/deal-name"
import { displayLabel } from "@/lib/utils/display-sanitize"

export interface YugoDealSource {
  /** Job identification */
  jobId?: string | null // "YG-30221" / "MV-30221" / "DLV-30203"
  jobNumber?: string | null // "30221"

  /** Client identity */
  firstName?: string | null
  lastName?: string | null

  /** Route */
  fromAddress?: string | null
  toAddress?: string | null
  fromAccess?: string | null
  toAccess?: string | null

  /** Service */
  serviceType?: string | null
  moveDate?: string | Date | null // ISO date or Date instance
  moveSize?: string | null

  /** Financial — all values pre-tax for subtotal */
  subtotal?: number | null
  hst?: number | null // when null we derive from subtotal × 0.13
  totalPrice?: number | null // when null we derive from subtotal + hst

  /** Metadata */
  isPmMove?: boolean | null
  tierSelected?: string | null
  crewSize?: number | null
  estimatedHours?: number | null
  truckType?: string | null
  cityHint?: string | null // optional city pulled out of address
  lostReason?: string | null
  vertical?: string | null
  businessName?: string | null
}

const isB2bSlug = (s: string | null | undefined) => {
  const v = String(s ?? "").trim().toLowerCase()
  return (
    v === "b2b_delivery" ||
    v === "b2b_oneoff" ||
    v === "b2b_one_off" ||
    v === "commercial_delivery" ||
    v === "specialty"
  )
}

function deriveHst(subtotal: number | null | undefined, hst: number | null | undefined): number {
  if (typeof hst === "number" && Number.isFinite(hst) && hst >= 0) return Math.round(hst * 100) / 100
  if (typeof subtotal === "number" && Number.isFinite(subtotal) && subtotal > 0) {
    return Math.round(subtotal * 0.13 * 100) / 100
  }
  return 0
}

function isoDateOnly(d: string | Date | null | undefined): string {
  if (!d) return ""
  try {
    const dt = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d
    if (Number.isNaN(dt.getTime())) return ""
    return dt.toISOString().slice(0, 10)
  } catch {
    return ""
  }
}

/** Human-readable summary used for `yugo_additional_info`. */
function buildAdditionalInfo(src: YugoDealSource): string {
  const cat = serviceCategory(src.serviceType, src.isPmMove)
  const parts: string[] = []
  const tier = String(src.tierSelected ?? "").trim()
  if (tier && cat === "residential") parts.push(`Tier: ${displayLabel(tier)}`)
  const moveSize = String(src.moveSize ?? "").trim()
  if (moveSize && cat === "residential") parts.push(`Size: ${displayLabel(moveSize)}`)
  if (src.vertical && cat === "b2b") parts.push(`Vertical: ${displayLabel(String(src.vertical))}`)
  if (src.businessName) parts.push(`Company: ${src.businessName}`)
  if (typeof src.crewSize === "number" && src.crewSize > 0) parts.push(`Crew: ${src.crewSize}`)
  if (typeof src.estimatedHours === "number" && src.estimatedHours > 0) parts.push(`Est. hours: ${src.estimatedHours}h`)
  if (src.truckType) parts.push(`Truck: ${displayLabel(String(src.truckType))}`)
  if (src.cityHint) parts.push(`City: ${src.cityHint}`)
  return parts.filter(Boolean).join(" · ")
}

/**
 * Build every yugo_* property for a deal. Empty strings are OMITTED so partial
 * updates don't wipe existing data — HubSpot treats missing keys as "no change".
 */
export function buildAllYugoProperties(src: YugoDealSource): Record<string, string> {
  const out: Record<string, string> = {}

  // ── Identity ────────────────────────────────────────────────
  const jobId = String(src.jobId ?? "").trim()
  if (jobId) out.yugo_job_id = jobId
  const jobNo = String(src.jobNumber ?? "").trim() || jobId.replace(/^[A-Z]+-/, "")
  if (jobNo) out.yugo_job_number = jobNo

  // ── Client ──────────────────────────────────────────────────
  const fn = String(src.firstName ?? "").trim()
  const ln = String(src.lastName ?? "").trim()
  if (fn) out.yugo_first_name = fn
  if (ln) out.yugo_last_name = ln

  // ── Route ──────────────────────────────────────────────────
  const fromAddr = String(src.fromAddress ?? "").trim()
  const toAddr = String(src.toAddress ?? "").trim()
  if (fromAddr) out.yugo_pickup_address = fromAddr
  if (toAddr) out.yugo_dropoff_address = toAddr
  const fromAcc = String(src.fromAccess ?? "").trim()
  const toAcc = String(src.toAccess ?? "").trim()
  if (fromAcc) out.yugo_access_from = displayLabel(fromAcc)
  if (toAcc) out.yugo_access_to = displayLabel(toAcc)

  // ── Service ────────────────────────────────────────────────
  const svc = String(src.serviceType ?? "").trim()
  if (svc) out.yugo_service_type = displayLabel(src.isPmMove ? "pm_move" : svc)
  const moveDateIso = isoDateOnly(src.moveDate)
  if (moveDateIso) out.yugo_move_date = moveDateIso
  const sz = String(src.moveSize ?? "").trim()
  if (sz && !isB2bSlug(svc)) out.yugo_move_size = displayLabel(sz)

  // ── Financial ─────────────────────────────────────────────
  const subtotal =
    typeof src.subtotal === "number" && Number.isFinite(src.subtotal) ? src.subtotal : null
  if (subtotal != null) {
    out.yugo_subtotal = String(Math.round(subtotal * 100) / 100)
    const hst = deriveHst(subtotal, src.hst)
    out.yugo_taxes = String(hst)
    const total =
      typeof src.totalPrice === "number" && Number.isFinite(src.totalPrice) && src.totalPrice > 0
        ? src.totalPrice
        : subtotal + hst
    out.yugo_total_price = String(Math.round(total * 100) / 100)
  }

  // ── Metadata ──────────────────────────────────────────────
  const addl = buildAdditionalInfo(src)
  if (addl) out.yugo_additional_info = addl
  const cat = serviceCategory(src.serviceType, src.isPmMove)
  out.yugo_deal_type = cat === "b2b" ? "B2B" : cat === "pm" ? "PM" : "Residential"
  const lost = String(src.lostReason ?? "").trim()
  if (lost) out.yugo_lost_reason = lost

  return out
}
