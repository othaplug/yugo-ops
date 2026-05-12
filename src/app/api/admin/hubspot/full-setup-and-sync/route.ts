import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"
import { ensureHubSpotCustomProperties } from "@/lib/hubspot/setup"
import { buildAllYugoProperties } from "@/lib/hubspot/deal-properties-builder"

const HS_DEAL_PATCH_BASE = "https://api.hubapi.com/crm/v3/objects/deals"

interface SyncEntry {
  jobId: string
  hubspotDealId: string
  result: "patched" | "skipped" | "failed"
  error?: string
}

/**
 * POST /api/admin/hubspot/full-setup-and-sync
 *
 * Two-phase operation:
 *   1) Ensure every yugo_* custom deal property exists in the HubSpot portal
 *   2) PATCH every quote + move + delivery that has a hubspot_deal_id, sending
 *      the full set of yugo_* properties so historic deals catch up
 *
 * Both phases run unconditionally; partial failures are surfaced in the response.
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

  // ── Phase 1: properties ────────────────────────────────────────
  const setup = await ensureHubSpotCustomProperties(token)
  console.log("[HubSpot full setup]", setup)

  // ── Phase 2: backfill existing deals ─────────────────────────
  const sb = createAdminClient()
  const entries: SyncEntry[] = []

  // Quotes that have a hubspot_deal_id. The quotes table has NO first_name /
  // last_name columns — the original sync silently 400'd on every load,
  // returning zero rows. Names live on the joined `contacts` row instead.
  const { data: quotes } = await sb
    .from("quotes")
    .select(
      "quote_id, hubspot_deal_id, from_address, to_address, from_access, to_access, service_type, move_date, move_size, custom_price, tiers, est_crew_size, est_hours, truck_primary, recommended_tier, b2b_business_name, contact_id, contacts:contact_id(name)",
    )
    .not("hubspot_deal_id", "is", null)

  for (const q of quotes ?? []) {
    const tiers = q.tiers as Record<string, { price?: number }> | null
    const price =
      tiers?.essential?.price ?? tiers?.curated?.price ?? Number(q.custom_price ?? 0) ?? null
    const contactRaw = (q as { contacts?: { name?: string | null } | { name?: string | null }[] | null })
      .contacts
    const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw
    const fullName = String(contact?.name ?? "").trim()
    const parts = fullName.split(/\s+/)
    const firstName = parts.shift() ?? ""
    const lastName = parts.join(" ")
    const props = buildAllYugoProperties({
      jobId: q.quote_id,
      firstName,
      lastName,
      fromAddress: q.from_address,
      toAddress: q.to_address,
      fromAccess: q.from_access,
      toAccess: q.to_access,
      serviceType: q.service_type,
      moveDate: q.move_date,
      moveSize: q.move_size,
      subtotal: price,
      tierSelected: q.recommended_tier,
      crewSize: q.est_crew_size,
      estimatedHours: q.est_hours,
      truckType: q.truck_primary,
      isPmMove: false,
      businessName: q.b2b_business_name,
    })
    entries.push(await patchDeal(token, q.hubspot_deal_id, q.quote_id, props))
  }

  // Moves that have a hubspot_deal_id
  const { data: moves } = await sb
    .from("moves")
    .select(
      "move_code, hubspot_deal_id, client_name, tenant_name, from_address, to_address, from_access, to_access, service_type, scheduled_date, move_size, estimate, amount, total_price, tier_selected, est_crew_size, est_hours, truck_primary, is_pm_move",
    )
    .not("hubspot_deal_id", "is", null)

  for (const m of moves ?? []) {
    const name = String(m.client_name ?? m.tenant_name ?? "").trim()
    const parts = name.split(/\s+/)
    const fn = parts.shift() || ""
    const ln = parts.join(" ")
    const subtotal =
      typeof m.estimate === "number"
        ? m.estimate
        : typeof m.amount === "number"
          ? m.amount
          : typeof m.total_price === "number"
            ? m.total_price
            : null
    const props = buildAllYugoProperties({
      jobId: m.move_code,
      firstName: fn,
      lastName: ln,
      fromAddress: m.from_address,
      toAddress: m.to_address,
      fromAccess: m.from_access,
      toAccess: m.to_access,
      serviceType: m.service_type,
      moveDate: m.scheduled_date,
      moveSize: m.move_size,
      subtotal,
      tierSelected: m.tier_selected,
      crewSize: m.est_crew_size,
      estimatedHours: m.est_hours,
      truckType: m.truck_primary,
      isPmMove: !!m.is_pm_move,
    })
    entries.push(await patchDeal(token, m.hubspot_deal_id, m.move_code, props))
  }

  const patched = entries.filter((e) => e.result === "patched").length
  const failed = entries.filter((e) => e.result === "failed").length
  const skipped = entries.filter((e) => e.result === "skipped").length

  return NextResponse.json(
    {
      setup,
      sync: { patched, failed, skipped, entries },
      message: `Setup: ${setup.created.length} created, ${setup.existing.length} existing, ${setup.failed.length} failed. Sync: ${patched} patched, ${failed} failed, ${skipped} skipped.`,
    },
    { status: setup.failed.length === 0 && failed === 0 ? 200 : 207 },
  )
}

async function patchDeal(
  token: string,
  dealId: string,
  jobId: string,
  props: Record<string, string>,
): Promise<SyncEntry> {
  if (Object.keys(props).length === 0) {
    return { jobId, hubspotDealId: dealId, result: "skipped" }
  }
  try {
    const res = await fetch(`${HS_DEAL_PATCH_BASE}/${dealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: props }),
    })
    if (!res.ok) {
      const t = await res.text()
      return {
        jobId,
        hubspotDealId: dealId,
        result: "failed",
        error: `${res.status} ${t.slice(0, 200)}`,
      }
    }
    return { jobId, hubspotDealId: dealId, result: "patched" }
  } catch (err) {
    return {
      jobId,
      hubspotDealId: dealId,
      result: "failed",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}
