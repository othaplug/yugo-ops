/**
 * Shared deal property helpers for HubSpot deal creation.
 *
 * - `dealPackageType`: correct `package_type` value — never leaks residential
 *   tier labels (signature / curated / essential) into B2B or PM deals.
 * - `yugoJobProperties`: thin pass-through that writes to the portal's real
 *   `job_no` and `service_type` properties. The earlier `yugo_job_id` /
 *   `yugo_job_number` / `yugo_service_type` writes targeted phantom fields
 *   created by the legacy setup; they're left alone here so the portal's
 *   actual deal cards populate.
 */

import { serviceCategory } from "@/lib/hubspot/deal-name"
import { mapServiceTypeToHubSpot } from "@/lib/hubspot/deal-properties-builder"

/**
 * HubSpot `package_type` is an enum dropdown with three values only:
 *   Yugo Basic  · Yugo Plus+  · Yugo VIP
 *
 * Internal slugs (essential / signature / estate / b2b / pm_move) trip
 * 400 INVALID_OPTION and silently kill the entire deal create — same
 * failure mode as service_type (fix L). Map all internal values to one
 * of the three allowed enum strings.
 *
 *   essential / curated   → Yugo Basic
 *   signature / premier   → Yugo Plus+
 *   estate                → Yugo VIP
 *   b2b / pm              → Yugo Plus+ (closest match: professional
 *                           white-glove without the Estate concierge
 *                           overhead)
 */
const PACKAGE_TYPE_HUBSPOT_VALUES: Record<string, string> = {
  essential: "Yugo Basic",
  curated: "Yugo Basic",
  essentials: "Yugo Basic",
  signature: "Yugo Plus+",
  premier: "Yugo Plus+",
  estate: "Yugo VIP",
  b2b: "Yugo Plus+",
  pm: "Yugo Plus+",
  pm_move: "Yugo Plus+",
}

/**
 * Return the correct HubSpot `package_type` property value for a deal.
 *
 * B2B and PM deals always surface as Yugo Plus+ (their pricing tier in
 * HubSpot's reporting bucket). Residential deals use the selected tier;
 * default to Yugo Plus+ (Signature) when no tier is set.
 */
export function dealPackageType(
  serviceType: string | null | undefined,
  isPmMove: boolean | null | undefined,
  tierSelected: string | null | undefined,
): string {
  const cat = serviceCategory(serviceType, isPmMove)
  if (cat === "b2b" || cat === "pm") {
    return PACKAGE_TYPE_HUBSPOT_VALUES.b2b
  }
  const slug = String(tierSelected || "").trim().toLowerCase()
  return PACKAGE_TYPE_HUBSPOT_VALUES[slug] ?? "Yugo Plus+"
}

/**
 * Return real-portal deal properties for job identification + service routing.
 *
 * These overlap with what {@link buildAllDealProperties} writes, so they're
 * effectively a redundant alias kept for callers that historically imported
 * this helper. The values flow to the portal's `job_no` and `service_type`
 * fields — the same names the deal card UI reads.
 *
 * @param jobId       Full text ID, e.g. "YG-3009", "MV-30173", "DLV-30203"
 * @param jobNo       Numeric suffix only, e.g. "3009", "30173"
 * @param serviceType OPS+ service_type slug
 */
export function yugoJobProperties(opts: {
  jobId?: string | null
  jobNo?: string | null
  serviceType?: string | null
}): Record<string, string> {
  const out: Record<string, string> = {}
  const no = opts.jobNo?.trim() || opts.jobId?.trim().replace(/^[A-Z]+-/, "")
  // HubSpot's service_type is an enum dropdown — writing the raw OPS+
  // slug ("cabinetry", "b2b_oneoff", etc.) trips 400 INVALID_OPTION
  // and silently kills the entire deal create. Route through the
  // shared SERVICE_TYPE_HUBSPOT_VALUES mapper so this helper and
  // buildAllDealProperties (which spreads after it) write the same
  // canonical value. Unmapped slugs → omitted (don't crash the create).
  const stMapped = mapServiceTypeToHubSpot(opts.serviceType)
  if (no) out.job_no = no
  if (stMapped) out.service_type = stMapped
  return out
}
