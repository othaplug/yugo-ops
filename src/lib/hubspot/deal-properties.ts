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

/**
 * Return the correct HubSpot `package_type` property value for a deal.
 *
 * B2B and PM deals always get "b2b".
 * Residential deals get the actual tier slug (signature / curated / essential),
 * defaulting to "signature" when no tier is set.
 */
export function dealPackageType(
  serviceType: string | null | undefined,
  isPmMove: boolean | null | undefined,
  tierSelected: string | null | undefined,
): string {
  const cat = serviceCategory(serviceType, isPmMove)
  if (cat === "b2b" || cat === "pm") return "b2b"
  return String(tierSelected || "").trim() || "signature"
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
  const st = opts.serviceType?.trim().toLowerCase()
  if (no) out.job_no = no
  if (st) out.service_type = st
  return out
}
