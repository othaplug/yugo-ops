/**
 * Single source of truth for the custom-property payload written to every
 * HubSpot deal from quote, move, and delivery creates / retries.
 *
 * IMPORTANT — internal-name discipline:
 *
 *   We previously wrote to `yugo_*` prefixed properties that were auto-created
 *   by `setup.ts`. The portal's actual deal properties have **no prefix**
 *   (`job_no`, `client_name`, `pick_up_address`, etc.) so every write went to
 *   phantom fields while the real cards stayed empty. This builder now writes
 *   directly to the portal-defined internal names below — verified against the
 *   owner's portal property settings on 2026-05-12.
 *
 *   If you add a new property, the internal name must EXIST in the portal
 *   first (see HubSpot → Settings → Properties → Deals). Don't auto-create.
 *
 * The list of property names MUST stay in sync with `LEGACY_YUGO_PROPS` in
 * setup.ts when cleaning up old phantom properties.
 */

import { serviceCategory } from "@/lib/hubspot/deal-name"
import { displayLabel } from "@/lib/utils/display-sanitize"

/**
 * HubSpot enum value maps — discovered via GET /crm/v3/properties/deals/<name>
 * on 2026-05-12. These are the EXACT allowed values for select/radio/checkbox
 * properties; writing anything else returns HTTP 400 and the whole patch
 * fails. Unmapped values are OMITTED so other properties still write through.
 *
 * If the portal owner adds a new enum option, mirror it here.
 */
const ACCESS_HUBSPOT_VALUES: Record<string, string> = {
  ground: "Ground floor",
  ground_floor: "Ground floor",
  groundfloor: "Ground floor",
  elevator: "Elevator",
  basement: "Basement",
  second_floor: "Second floor",
  walk_up_2: "Second floor",
  walk_up_2nd: "Second floor",
  third_floor: "Third floor+",
  walk_up_3: "Third floor+",
  walk_up_3rd: "Third floor+",
  walk_up_4_plus: "Third floor+",
  walk_up_4plus: "Third floor+",
  walk_up_4th: "Third floor+",
  walk_up_4th_plus: "Third floor+",
  // Slugs without a direct portal enum (loading_dock, concierge, long_carry,
  // narrow_stairs, no_parking) intentionally omitted — they'll skip the write
  // rather than reject the whole payload. Owner can add them to the portal
  // enum and extend this map.
}

const MOVE_SIZE_HUBSPOT_VALUES: Record<string, string> = {
  studio: "Studio",
  bachelor: "Studio",
  small: "Small",
  partial: "Small",
  "1br": "1BR",
  "1br_den": "1BR + Den",
  "2br": "2BR",
  "2br_den": "2BR + Den",
  "3br": "3BR",
  "4br": "4BR+",
  "4br_plus": "4BR+",
  "5br": "4BR+",
  "5br_plus": "4BR+",
  office_small: "Commercial",
  office_medium: "Commercial",
  office_large: "Commercial",
  custom: "Specialty",
  specialty: "Specialty",
  single_item: "Single Item",
}

const SERVICE_TYPE_HUBSPOT_VALUES: Record<string, string> = {
  local_move: "Local Move",
  long_distance: "Long-Distance Move",
  long_distance_move: "Long-Distance Move",
  office_move: "Office Move",
  office: "Office Move",
  specialty: "Specialty Move",
  white_glove: "White Glove Move",
  single_item: "Single Item",
  event: "Event Services",
  event_logistics: "Event Services",
  // PM moves run through residential infrastructure — surface as Local Move
  // so reporting filters group them with other residential bookings.
  pm_move: "Local Move",
  b2b_delivery: "Home Delivery",
  b2b_oneoff: "Home Delivery",
  b2b_one_off: "Home Delivery",
  commercial_delivery: "Home Delivery",
  white_glove_delivery: "White Glove Delivery",
  // bin_rental + labour_only have no precise enum match — fall through to "Other".
  bin_rental: "Other",
  labour_only: "Other",
}

const LOST_REASON_HUBSPOT_VALUES: Record<string, string> = {
  too_expensive: "Too Expensive",
  competitor: "Chose Competitor",
  chose_competitor: "Chose Competitor",
  date_unavailable: "Date Unavailable",
  scope_changed: "Scope Changed",
  no_response: "No Response",
  unresponsive: "No Response",
  timing: "Timing",
  diy: "DIY",
  other: "Other",
}

function mapEnum(raw: string | null | undefined, table: Record<string, string>): string | null {
  const v = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
  if (!v) return null
  return table[v] ?? null
}

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

/** Human-readable summary used for `additional_info`. */
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
 * Build every deal property (using the portal's real internal names) for a
 * HubSpot create / update. Empty strings are OMITTED so partial updates don't
 * wipe existing data — HubSpot treats missing keys as "no change".
 *
 * Internal-name mapping (left side = portal, right side = source field):
 *
 *   job_no            ← jobNumber (e.g. "30221")
 *   client_name       ← firstName (portal label: "First name", stores first name)
 *   last_name         ← lastName
 *   pick_up_address   ← fromAddress
 *   access            ← fromAccess (slug — let portal map enum if dropdown)
 *   drop_off_address  ← toAddress
 *   access_to         ← toAccess (slug)
 *   service_type      ← serviceType slug (pm_move when isPmMove)
 *   move_date         ← moveDate (YYYY-MM-DD)
 *   move_size         ← moveSize slug (skipped for B2B verticals)
 *   sub_total         ← subtotal pre-tax
 *   taxes             ← HST (derived as subtotal × 0.13 when not supplied)
 *   total_price       ← total (subtotal + taxes when not supplied)
 *   additional_info   ← composed crew/hours/truck/tier/size/vertical summary
 *   dealtype          ← "residential" | "pm" | "b2b" (lowercase enum-safe)
 *   lost_reason       ← lostReason free text
 */
export function buildAllDealProperties(src: YugoDealSource): Record<string, string> {
  const out: Record<string, string> = {}

  // ── Identity ────────────────────────────────────────────────
  const jobId = String(src.jobId ?? "").trim()
  const jobNo = String(src.jobNumber ?? "").trim() || jobId.replace(/^[A-Z]+-/, "")
  if (jobNo) out.job_no = jobNo

  // ── Client ──────────────────────────────────────────────────
  const fn = String(src.firstName ?? "").trim()
  const ln = String(src.lastName ?? "").trim()
  if (fn) out.client_name = fn
  if (ln) out.last_name = ln

  // ── Route ──────────────────────────────────────────────────
  const fromAddr = String(src.fromAddress ?? "").trim()
  const toAddr = String(src.toAddress ?? "").trim()
  if (fromAddr) out.pick_up_address = fromAddr
  if (toAddr) out.drop_off_address = toAddr

  // Access: enum dropdown in HubSpot — must match one of the portal values
  // exactly ("Ground floor", "Elevator", "Basement", "Second floor",
  // "Third floor+"). Unmapped slugs (e.g. "loading_dock", "concierge")
  // are omitted so the rest of the payload still writes through.
  const accessVal = mapEnum(src.fromAccess, ACCESS_HUBSPOT_VALUES)
  const accessToVal = mapEnum(src.toAccess, ACCESS_HUBSPOT_VALUES)
  if (accessVal) out.access = accessVal
  if (accessToVal) out.access_to = accessToVal

  // ── Service ────────────────────────────────────────────────
  // service_type is a multi-select checkbox in HubSpot — but a single value
  // write still works since HubSpot stores it as a `;`-joined string.
  const svcRaw = String(src.serviceType ?? "").trim().toLowerCase()
  const svcKey = src.isPmMove ? "pm_move" : svcRaw
  const svcVal = mapEnum(svcKey, SERVICE_TYPE_HUBSPOT_VALUES)
  if (svcVal) out.service_type = svcVal

  const moveDateIso = isoDateOnly(src.moveDate)
  if (moveDateIso) out.move_date = moveDateIso

  // move_size enum — "Studio", "1BR", "2BR", "3BR", "4BR+", "Commercial",
  // "Specialty", "Single Item". Omit for B2B verticals where size isn't
  // meaningful.
  if (!isB2bSlug(svcRaw)) {
    const sizeVal = mapEnum(src.moveSize, MOVE_SIZE_HUBSPOT_VALUES)
    if (sizeVal) out.move_size = sizeVal
  }

  // ── Financial ─────────────────────────────────────────────
  const subtotal =
    typeof src.subtotal === "number" && Number.isFinite(src.subtotal) ? src.subtotal : null
  if (subtotal != null) {
    out.sub_total = String(Math.round(subtotal * 100) / 100)
    const hst = deriveHst(subtotal, src.hst)
    out.taxes = String(hst)
    const total =
      typeof src.totalPrice === "number" && Number.isFinite(src.totalPrice) && src.totalPrice > 0
        ? src.totalPrice
        : subtotal + hst
    out.total_price = String(Math.round(total * 100) / 100)
  }

  // ── Metadata ──────────────────────────────────────────────
  const addl = buildAdditionalInfo(src)
  if (addl) out.additional_info = addl

  // dealtype is HubSpot's standard radio property — values restricted to
  // "newbusiness" / "existingbusiness". Every quote-derived deal is
  // newbusiness by definition (we don't track returning-customer status
  // on the quote yet). Skip for retries that already have a dealtype.
  out.dealtype = "newbusiness"

  const lostVal = mapEnum(src.lostReason, LOST_REASON_HUBSPOT_VALUES)
  if (lostVal) out.lost_reason = lostVal

  return out
}

/**
 * Back-compat alias. Existing call sites import `buildAllYugoProperties` —
 * keep the name working so we can update the body in one place without
 * rippling through 7 callers in the same PR.
 *
 * @deprecated Use `buildAllDealProperties` for new code.
 */
export const buildAllYugoProperties = buildAllDealProperties
