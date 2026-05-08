/**
 * Shared deal property helpers for HubSpot deal creation.
 *
 * - `dealPackageType`: correct `package_type` value — never leaks residential
 *   tier labels (signature / curated / essential) into B2B or PM deals.
 * - `yugoJobProperties`: Yugo-branded `yugo_job_id`, `yugo_job_number`,
 *   `yugo_service_type` properties added to every deal create/update.
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
 * Return Yugo-branded custom deal properties for search and reporting in HubSpot.
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
  const id = opts.jobId?.trim()
  const no = opts.jobNo?.trim()
  const st = opts.serviceType?.trim()
  if (id) out.yugo_job_id = id
  if (no) out.yugo_job_number = no
  if (st) out.yugo_service_type = st
  return out
}
