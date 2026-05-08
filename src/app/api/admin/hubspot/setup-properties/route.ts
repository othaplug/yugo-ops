import { NextResponse } from "next/server"
import { requireStaff } from "@/lib/api-auth"
import { ensureHubSpotCustomProperties } from "@/lib/hubspot/setup"

/**
 * POST /api/admin/hubspot/setup-properties
 *
 * Creates (or confirms) the three Yugo-branded custom deal properties
 * (yugo_job_id, yugo_job_number, yugo_service_type) in the connected HubSpot portal.
 * Safe to call multiple times — HTTP 409 (already exists) is treated as success.
 *
 * Requires HUBSPOT_ACCESS_TOKEN.
 */
export async function POST() {
  const { error: authError } = await requireStaff()
  if (authError) return authError

  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_ACCESS_TOKEN environment variable is not set" },
      { status: 503 },
    )
  }

  const result = await ensureHubSpotCustomProperties(token)

  const allOk = result.failed.length === 0
  return NextResponse.json(result, { status: allOk ? 200 : 207 })
}
