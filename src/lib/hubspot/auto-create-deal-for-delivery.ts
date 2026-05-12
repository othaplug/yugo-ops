import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline"
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id"
import { findExistingOpenDealForContactEmail } from "@/lib/hubspot/find-existing-open-deal"
import { findOrCreateHubSpotContact } from "@/lib/hubspot/auto-create-deal-for-quote"
import { patchHubSpotDealJobNo } from "@/lib/hubspot/sync-deal-job-no"
import { buildHubSpotDealName } from "@/lib/hubspot/deal-name"
import { yugoJobProperties } from "@/lib/hubspot/deal-properties"
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder"
import type { HubSpotAutoCreateDealResult } from "@/lib/hubspot/auto-create-deal-types"
import { deliveryNumericJobNoForHubSpot } from "@/lib/move-code"

const HS_DEALS = "https://api.hubapi.com/crm/v3/objects/deals"

function dealToContactAssociationTypeId(): number {
  const raw = process.env.HUBSPOT_DEAL_CONTACT_ASSOCIATION_TYPE_ID
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 3
}

function deliveryServiceLabel(delivery: {
  booking_type?: string | null
  vertical_code?: string | null
}): string {
  const bt = String(delivery.booking_type || "").trim().toLowerCase()
  if (bt === "one_off") return "b2b_one_off_delivery"
  if (bt === "day_rate") return "b2b_day_rate_delivery"
  const vc = String(delivery.vertical_code || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (vc) return vc
  return "b2b_delivery"
}


function preTaxAmountForHubSpot(delivery: {
  calculated_price?: number | null
  quoted_price?: number | null
}): number | null {
  const calc = delivery.calculated_price
  if (calc != null && Number.isFinite(Number(calc)) && Number(calc) > 0) {
    return Math.round(Number(calc))
  }
  const qp = delivery.quoted_price
  if (qp != null && Number.isFinite(Number(qp)) && Number(qp) > 0) {
    return Math.round(Number(qp))
  }
  return null
}

/**
 * When a delivery is created in Ops+ (admin), create a HubSpot deal at "booked" like standalone moves.
 * B2B one-off and other admin bookings never hit quote send, so this path was missing.
 */
export async function autoCreateHubSpotDealForNewDelivery(opts: {
  sb: SupabaseClient
  delivery: {
    id: string
    scheduled_date?: string | null
    pickup_address?: string | null
    delivery_address?: string | null
    pickup_access?: string | null
    delivery_access?: string | null
    calculated_price?: number | null
    quoted_price?: number | null
    total_price?: number | null
    booking_type?: string | null
    vertical_code?: string | null
    business_name?: string | null
    client_name?: string | null
    contact_name?: string | null
  }
  deliveryNumber: string
  clientEmail: string
  firstName: string
  lastName: string
  clientPhone?: string | null
  deliveryAdminUrl: string
  skipDuplicateCheck?: boolean
}): Promise<HubSpotAutoCreateDealResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    console.error(
      "[HubSpot] HUBSPOT_ACCESS_TOKEN is not set. Cannot create deals for new deliveries.",
    )
    return null
  }

  const {
    sb,
    delivery,
    deliveryNumber,
    clientEmail,
    firstName,
    lastName,
    clientPhone,
    deliveryAdminUrl,
    skipDuplicateCheck,
  } = opts

  if (!skipDuplicateCheck) {
    const existing = await findExistingOpenDealForContactEmail(sb, token, clientEmail, {
      serviceTypeCat: "b2b",
    })
    if (existing) {
      return {
        status: "duplicate",
        existingDealId: existing.dealId,
        existingDealName: existing.dealName,
        existingDealStageId: existing.dealStageId,
      }
    }
  }

  const pipelineId = await resolveHubSpotPipelineId(sb)
  if (!pipelineId) {
    console.error(
      "[HubSpot] hubspot_pipeline_id is not set and HUBSPOT_PIPELINE_ID is not set. Cannot create delivery deal.",
    )
    return null
  }

  const stageId = await resolveHubSpotStageInternalId(sb, "booked")
  if (!stageId) {
    return null
  }

  const svc = deliveryServiceLabel(delivery)
  const jobNo = deliveryNumericJobNoForHubSpot(deliveryNumber)

  const dealName = buildHubSpotDealName({
    serviceType: svc,
    isPmMove: false,
    firstName,
    lastName,
    businessName: String(delivery.business_name || "").trim() || undefined,
    fromAddress: String(delivery.pickup_address ?? "").trim() || undefined,
    date: String(delivery.scheduled_date ?? "").trim() || undefined,
    fallbackCode: `Delivery ${deliveryNumber}`,
  })

  const contactId = await findOrCreateHubSpotContact(token, {
    email: clientEmail,
    firstName,
    lastName,
    phone: clientPhone ?? null,
  })

  const amount = preTaxAmountForHubSpot(delivery)

  // Single payload built via the shared deal-properties builder so deliveries
  // get the same portal-name discipline as quotes and moves. The builder
  // writes `pick_up_address`, `drop_off_address`, `access`, `access_to`,
  // `service_type`, `move_date`, `job_no`, etc. — every field the owner
  // listed in their portal property audit.
  const properties: Record<string, string> = {
    dealname: dealName,
    pipeline: pipelineId,
    dealstage: stageId,
    quote_url: deliveryAdminUrl,
    firstname: firstName,
    lastname: lastName,
    package_type: "b2b",
    ...yugoJobProperties({ jobId: deliveryNumber, jobNo, serviceType: svc }),
    ...buildAllDealProperties({
      jobId: deliveryNumber,
      jobNumber: jobNo,
      firstName,
      lastName,
      fromAddress: delivery.pickup_address,
      toAddress: delivery.delivery_address,
      fromAccess: delivery.pickup_access,
      toAccess: delivery.delivery_access,
      serviceType: svc,
      moveDate: delivery.scheduled_date,
      subtotal: amount,
      isPmMove: false,
      businessName: delivery.business_name,
    }),
  }

  if (amount != null) properties.amount = String(amount)

  const body: Record<string, unknown> = { properties }
  if (contactId) {
    body.associations = [
      {
        to: { id: contactId },
        types: [
          {
            associationCategory: "HUBSPOT_DEFINED",
            associationTypeId: dealToContactAssociationTypeId(),
          },
        ],
      },
    ]
  }

  const dealRes = await fetch(HS_DEALS, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!dealRes.ok) {
    const t = await dealRes.text()
    console.error(
      `[HubSpot] create deal failed for delivery ${deliveryNumber}:`,
      dealRes.status,
      t.slice(0, 2000),
    )
    return null
  }

  const dealData = (await dealRes.json()) as { id?: string }
  const dealId = dealData.id
  if (!dealId) return null

  if (jobNo) {
    await patchHubSpotDealJobNo(token, dealId, jobNo).catch((e) =>
      console.warn("[HubSpot] patch job_no after delivery deal create:", e),
    )
  }

  return { status: "created", dealId }
}
