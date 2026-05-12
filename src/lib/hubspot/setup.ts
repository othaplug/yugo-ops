/**
 * HubSpot account setup — verify the deal properties OPS+ writes to.
 *
 * Historically this file CREATED a parallel set of `yugo_*` properties via
 * the HubSpot API. That was wrong: the portal already has the real fields
 * (`job_no`, `client_name`, `pick_up_address`, etc.) and writing to a
 * `yugo_*` shadow set meant every deal showed empty cards. The auto-created
 * phantoms remain in the portal as empty fields — the owner can delete them
 * manually from HubSpot → Settings → Properties → Deals.
 *
 * This module now just **verifies** that every property the builder will
 * write actually exists in the portal. No creation. The signature is
 * preserved so `full-setup-and-sync` can keep calling it as a sanity check
 * before the per-deal PATCH pass runs.
 */

const HS_DEAL_PROPS_URL = "https://api.hubapi.com/crm/v3/properties/deals"

/**
 * Real portal property internal names — discovered by the owner via
 * HubSpot → Settings → Properties → Deals → Filter by group "OPS+ Details".
 *
 * Adding a property here means `deal-properties-builder.ts` will (or already
 * does) write to it. The name MUST match the portal's internal name exactly,
 * including case. Audit a sample deal in HubSpot before adding new names.
 */
const PORTAL_DEAL_PROPS = [
  "job_no",
  "client_name", // portal label: "First name" (stores first name only)
  "last_name",
  "pick_up_address",
  "access", // portal label: "Access from"
  "drop_off_address",
  "access_to",
  "service_type",
  "move_date",
  "move_size",
  "sub_total",
  "taxes",
  "total_price",
  "additional_info",
  "dealtype", // HubSpot standard deal property — values "residential" | "pm" | "b2b"
  "lost_reason",
] as const

/**
 * Phantom properties auto-created by the legacy setup. Listed here for
 * diagnostics — they exist in the portal as empty fields and should be
 * deleted manually by the owner. We never write to them.
 */
const LEGACY_YUGO_PROPS = [
  "yugo_job_id",
  "yugo_job_number",
  "yugo_first_name",
  "yugo_last_name",
  "yugo_pickup_address",
  "yugo_dropoff_address",
  "yugo_access_from",
  "yugo_access_to",
  "yugo_service_type",
  "yugo_move_date",
  "yugo_move_size",
  "yugo_subtotal",
  "yugo_taxes",
  "yugo_total_price",
  "yugo_additional_info",
  "yugo_deal_type",
  "yugo_lost_reason",
] as const

export type EnsurePropsResult = {
  /** Property names verified present in the portal. */
  created: string[]
  /** Synonym for back-compat with the old creation-style return shape. */
  existing: string[]
  /** Property names the portal returned 404 for — owner must create or audit. */
  failed: string[]
}

/**
 * Verify (but do not create) the portal deal properties OPS+ writes to.
 * Result is shaped to match the old creation-style return so existing
 * callers in `/api/admin/hubspot/full-setup-and-sync` keep working.
 *
 * - `created` / `existing` — present in the portal (we list them in both
 *   slots for back-compat with UI banners that read either one).
 * - `failed` — missing from the portal. Block the sync until the owner
 *   adds these manually under Settings → Properties → Deals.
 */
export async function ensureHubSpotCustomProperties(
  token: string,
): Promise<EnsurePropsResult> {
  const result: EnsurePropsResult = { created: [], existing: [], failed: [] }
  const BATCH = 5
  for (let i = 0; i < PORTAL_DEAL_PROPS.length; i += BATCH) {
    const chunk = PORTAL_DEAL_PROPS.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (name) => {
        try {
          const res = await fetch(`${HS_DEAL_PROPS_URL}/${encodeURIComponent(name)}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })
          if (res.ok) {
            result.existing.push(name)
            // Mirror into "created" too — the legacy banner in Platform
            // Settings reads `created.length` to surface a success count.
            result.created.push(name)
          } else if (res.status === 404) {
            console.error(
              `[HubSpot setup] Property ${name} missing in portal — create it manually under Settings → Properties → Deals.`,
            )
            result.failed.push(name)
          } else {
            const t = await res.text()
            console.error(
              `[HubSpot setup] Unexpected status verifying ${name}:`,
              res.status,
              t.slice(0, 300),
            )
            result.failed.push(name)
          }
        } catch (e) {
          console.error(`[HubSpot setup] Error verifying property ${name}:`, e)
          result.failed.push(name)
        }
      }),
    )
    if (i + BATCH < PORTAL_DEAL_PROPS.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return result
}

/** Names only — useful for diagnostic endpoints / sanity checks. */
export function listYugoCustomPropertyNames(): string[] {
  return [...PORTAL_DEAL_PROPS]
}

/** Phantom property names from the legacy auto-create — exposed for cleanup tooling. */
export function listLegacyYugoPropertyNames(): string[] {
  return [...LEGACY_YUGO_PROPS]
}
