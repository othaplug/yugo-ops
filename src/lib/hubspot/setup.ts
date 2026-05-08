/**
 * HubSpot account setup helpers — create custom deal properties required by OPS+.
 *
 * Call `ensureHubSpotCustomProperties` once per portal via the Platform Settings
 * "Setup HubSpot Properties" button. Subsequent calls are safe (existing properties
 * return HTTP 409 which is treated as success).
 */

const HS_DEAL_PROPS_URL = "https://api.hubapi.com/crm/v3/properties/deals"

interface HubSpotPropertyCreate {
  name: string
  label: string
  type: string
  fieldType: string
  groupName: string
  description?: string
}

const YUGO_CUSTOM_PROPS: HubSpotPropertyCreate[] = [
  {
    name: "yugo_job_id",
    label: "Yugo Job ID",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Full OPS+ job identifier, e.g. YG-3009 or DLV-30203",
  },
  {
    name: "yugo_job_number",
    label: "Yugo Job Number",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Numeric-only job number for HubSpot search, e.g. 30173",
  },
  {
    name: "yugo_service_type",
    label: "Yugo Service Type",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "OPS+ service_type slug (e.g. local_move, office_move, b2b_delivery)",
  },
]

export type EnsurePropsResult = {
  created: string[]
  existing: string[]
  failed: string[]
}

/**
 * Ensure Yugo-branded custom deal properties exist in the HubSpot portal.
 * Runs all three creates in parallel. HTTP 409 (already exists) is treated as success.
 */
export async function ensureHubSpotCustomProperties(
  token: string,
): Promise<EnsurePropsResult> {
  const result: EnsurePropsResult = { created: [], existing: [], failed: [] }

  await Promise.all(
    YUGO_CUSTOM_PROPS.map(async (prop) => {
      try {
        const res = await fetch(HS_DEAL_PROPS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(prop),
        })

        if (res.ok) {
          result.created.push(prop.name)
        } else if (res.status === 409) {
          result.existing.push(prop.name)
        } else {
          const t = await res.text()
          console.error(
            `[HubSpot setup] Failed to create property ${prop.name}:`,
            res.status,
            t.slice(0, 500),
          )
          result.failed.push(prop.name)
        }
      } catch (e) {
        console.error(`[HubSpot setup] Error creating property ${prop.name}:`, e)
        result.failed.push(prop.name)
      }
    }),
  )

  return result
}
