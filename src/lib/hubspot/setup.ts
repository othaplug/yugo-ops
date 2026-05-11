/**
 * HubSpot account setup helpers — create custom deal properties required by OPS+.
 *
 * Call `ensureHubSpotCustomProperties` once per portal via the Platform Settings
 * "Setup HubSpot Properties" button. Subsequent calls are safe (existing properties
 * return HTTP 409 which is treated as success).
 *
 * Every Yugo-branded custom property has a `yugo_` prefix. The `buildAllYugoProperties`
 * helper in `deal-properties-builder.ts` is the SINGLE source of truth for what
 * properties get populated on each deal. The list below must stay in sync with it.
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
  // ── Job identification ────────────────────────────────────────
  {
    name: "yugo_job_id",
    label: "OPS+ Job ID",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Full OPS+ job identifier (e.g. YG-30221, MV-30221, DLV-30203).",
  },
  {
    name: "yugo_job_number",
    label: "Job No",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Numeric-only job number for HubSpot search (e.g. 30221).",
  },

  // ── Client identity (deal-level mirrors of contact properties) ─
  {
    name: "yugo_first_name",
    label: "First Name",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Primary client first name (deal-level copy from the associated contact).",
  },
  {
    name: "yugo_last_name",
    label: "Last Name",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Primary client last name (deal-level copy from the associated contact).",
  },

  // ── Route ─────────────────────────────────────────────────────
  {
    name: "yugo_pickup_address",
    label: "Pick Up Address",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Origin address for the move/delivery.",
  },
  {
    name: "yugo_dropoff_address",
    label: "Drop Off Address",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Destination address for the move/delivery.",
  },
  {
    name: "yugo_access_from",
    label: "Access From",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Building access at pickup (elevator, walk-up, loading dock, etc.).",
  },
  {
    name: "yugo_access_to",
    label: "Access To",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Building access at destination.",
  },

  // ── Service details ───────────────────────────────────────────
  {
    name: "yugo_service_type",
    label: "Service Type",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "OPS+ service_type slug (e.g. local_move, white_glove, b2b_delivery).",
  },
  {
    name: "yugo_move_date",
    label: "Move Date",
    type: "date",
    fieldType: "date",
    groupName: "dealinformation",
    description: "Scheduled date of the move or delivery.",
  },
  {
    name: "yugo_move_size",
    label: "Move Size",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Home size for residential moves (studio, 1br, 2br, etc.). Empty for B2B.",
  },

  // ── Financial ─────────────────────────────────────────────────
  {
    name: "yugo_subtotal",
    label: "Sub-total",
    type: "number",
    fieldType: "number",
    groupName: "dealinformation",
    description: "Pre-tax price for the deal.",
  },
  {
    name: "yugo_taxes",
    label: "Taxes",
    type: "number",
    fieldType: "number",
    groupName: "dealinformation",
    description: "HST amount (13% on the subtotal).",
  },
  {
    name: "yugo_total_price",
    label: "Total Price",
    type: "number",
    fieldType: "number",
    groupName: "dealinformation",
    description: "Subtotal + taxes — the final amount the client will pay.",
  },

  // ── Metadata ──────────────────────────────────────────────────
  {
    name: "yugo_additional_info",
    label: "Additional Info",
    type: "string",
    fieldType: "textarea",
    groupName: "dealinformation",
    description: "Human-readable summary line — tier, crew size, hours, truck, city.",
  },
  {
    name: "yugo_deal_type",
    label: "Deal Type",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Top-level classification: Residential, B2B, or PM.",
  },
  {
    name: "yugo_lost_reason",
    label: "Lost Reason",
    type: "string",
    fieldType: "text",
    groupName: "dealinformation",
    description: "Set when the deal is marked lost — reason for the loss.",
  },
]

export type EnsurePropsResult = {
  created: string[]
  existing: string[]
  failed: string[]
}

/**
 * Ensure Yugo-branded custom deal properties exist in the HubSpot portal.
 * HTTP 409 (already exists) is treated as success. Rate-limited (~10/s) by
 * batching in chunks of 5 with a 200ms pause between batches.
 */
export async function ensureHubSpotCustomProperties(
  token: string,
): Promise<EnsurePropsResult> {
  const result: EnsurePropsResult = { created: [], existing: [], failed: [] }
  const BATCH = 5
  for (let i = 0; i < YUGO_CUSTOM_PROPS.length; i += BATCH) {
    const chunk = YUGO_CUSTOM_PROPS.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (prop) => {
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
    if (i + BATCH < YUGO_CUSTOM_PROPS.length) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  return result
}

/** Names only — useful for diagnostic endpoints / sanity checks. */
export function listYugoCustomPropertyNames(): string[] {
  return YUGO_CUSTOM_PROPS.map((p) => p.name)
}
