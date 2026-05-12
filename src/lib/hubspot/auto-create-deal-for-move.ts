import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline"
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id"
import { findExistingOpenDealForContactEmail } from "@/lib/hubspot/find-existing-open-deal"
import { findOrCreateHubSpotContact } from "@/lib/hubspot/auto-create-deal-for-quote"
import { patchHubSpotDealJobNo } from "@/lib/hubspot/sync-deal-job-no"
import { buildHubSpotDealName, serviceCategory } from "@/lib/hubspot/deal-name"
import { dealPackageType, yugoJobProperties } from "@/lib/hubspot/deal-properties"
import { buildAllYugoProperties } from "@/lib/hubspot/deal-properties-builder"
import { safeCreateDeal } from "@/lib/hubspot/safe-deal-write"
import type { HubSpotAutoCreateDealResult } from "@/lib/hubspot/auto-create-deal-types"
import { moveNumericJobNoForHubSpot } from "@/lib/move-code"

const HS_DEALS = "https://api.hubapi.com/crm/v3/objects/deals"

function dealToContactAssociationTypeId(): number {
  const raw = process.env.HUBSPOT_DEAL_CONTACT_ASSOCIATION_TYPE_ID
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 3
}

/**
 * When a move is created directly in Ops+ (no quote flow), create a HubSpot deal at the
 * "booked" stage so the job appears in the OPS+ pipeline. Best-effort; returns null on failure.
 * If an open deal already exists for the contact, returns duplicate (same as quote send).
 */
export async function autoCreateHubSpotDealForNewMove(opts: {
  sb: SupabaseClient
  move: {
    id: string
    service_type?: string | null
    move_size?: string | null
    scheduled_date?: string | null
    from_address?: string | null
    to_address?: string | null
    from_access?: string | null
    to_access?: string | null
    estimate?: number | null
    tier_selected?: string | null
    /** Portfolio PM moves — affects deal name prefix and package_type. */
    is_pm_move?: boolean | null
  }
  moveCode: string
  clientEmail: string
  firstName: string
  lastName: string
  /** Company / organisation name — used as B2B deal name subject when set. */
  businessName?: string | null
  clientPhone?: string | null
  /** Admin move detail URL; stored in deal quote_url (shared HubSpot field). */
  moveAdminUrl: string
  /** Skip when coordinator chose to create another deal (not wired for moves yet; reserved). */
  skipDuplicateCheck?: boolean
}): Promise<HubSpotAutoCreateDealResult> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    console.error("[HubSpot] HUBSPOT_ACCESS_TOKEN is not set. Cannot create deals for new moves.")
    return null
  }

  const {
    sb,
    move,
    moveCode,
    clientEmail,
    firstName,
    lastName,
    businessName,
    clientPhone,
    moveAdminUrl,
    skipDuplicateCheck,
  } = opts

  const svcType = String(move.service_type || "local_move").trim()
  const svcCat = serviceCategory(svcType, move.is_pm_move)

  if (!skipDuplicateCheck) {
    const existing = await findExistingOpenDealForContactEmail(sb, token, clientEmail, {
      serviceTypeCat: svcCat,
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
      "[HubSpot] hubspot_pipeline_id is not set and HUBSPOT_PIPELINE_ID is not set. Cannot create move deal.",
    )
    return null
  }

  const stageId = await resolveHubSpotStageInternalId(sb, "booked")
  if (!stageId) {
    return null
  }

  const dealName = buildHubSpotDealName({
    serviceType: svcType,
    isPmMove: move.is_pm_move,
    firstName,
    lastName,
    businessName: businessName ?? undefined,
    tierLabel: String(move.tier_selected ?? "").trim().replace(/_/g, " ") || undefined,
    moveSize: String(move.move_size ?? "").trim() || undefined,
    fromAddress: String(move.from_address ?? "").trim() || undefined,
    date: String(move.scheduled_date ?? "").trim() || undefined,
    fallbackCode: `Move ${moveCode}`,
  })

  const contactId = await findOrCreateHubSpotContact(token, {
    email: clientEmail,
    firstName,
    lastName,
    phone: clientPhone ?? null,
  })

  const jobNo = moveNumericJobNoForHubSpot(moveCode)

  // Standard HubSpot deal fields only. All OPS+ custom properties
  // (job_no, pick_up_address, access, access_to, service_type, move_date,
  // sub_total, taxes, total_price, etc.) flow through buildAllDealProperties
  // which writes the portal's real internal names — kept lean to avoid the
  // earlier `access_from` typo (portal expects `access`).
  const properties: Record<string, string> = {
    dealname: dealName,
    pipeline: pipelineId,
    dealstage: stageId,
    quote_url: moveAdminUrl,
    firstname: firstName,
    lastname: lastName,
    package_type: dealPackageType(svcType, move.is_pm_move, String(move.tier_selected ?? "").trim()),
    ...yugoJobProperties({ jobId: moveCode, jobNo, serviceType: svcType }),
    ...buildAllYugoProperties({
      jobId: moveCode,
      jobNumber: jobNo,
      firstName,
      lastName,
      fromAddress: move.from_address,
      toAddress: move.to_address,
      fromAccess: move.from_access,
      toAccess: move.to_access,
      serviceType: svcType,
      moveDate: move.scheduled_date,
      moveSize: move.move_size,
      subtotal: typeof move.estimate === "number" ? move.estimate : null,
      tierSelected: move.tier_selected,
      isPmMove: move.is_pm_move,
      businessName: businessName ?? null,
    }),
  }

  const est = move.estimate
  if (est != null && Number.isFinite(Number(est)) && Number(est) > 0) {
    properties.amount = String(Math.round(Number(est)))
  }

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

  const dealRes = await safeCreateDeal(token, body as { properties: Record<string, unknown>; associations?: unknown })

  if (!dealRes.ok) {
    const t = await dealRes.text()
    console.error(
      `[HubSpot] create deal failed for move ${moveCode}:`,
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
      console.warn("[HubSpot] patch job_no after move deal create:", e),
    )
  }

  return { status: "created", dealId }
}
