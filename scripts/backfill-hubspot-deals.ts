/**
 * One-shot backfill: PATCH every quote + move with a hubspot_deal_id using
 * the corrected portal-real property names. Mirrors what
 * /api/admin/hubspot/full-setup-and-sync does, but runs as a local script
 * so we don't need to mint a staff cookie to fire the protected route.
 *
 * Run with: `npx tsx scripts/backfill-hubspot-deals.ts`
 */
import { config as dotenvConfig } from "dotenv"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { buildAllDealProperties } from "../src/lib/hubspot/deal-properties-builder"

// .env.local is what `next dev` reads — keep parity with the running app.
dotenvConfig({ path: path.resolve(process.cwd(), ".env.local") })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const HS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN!
const HS_DEAL_PATCH_BASE = "https://api.hubapi.com/crm/v3/objects/deals"

if (!SUPABASE_URL || !SUPABASE_KEY || !HS_TOKEN) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HUBSPOT_ACCESS_TOKEN")
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

async function patchDeal(dealId: string, jobId: string, props: Record<string, string>) {
  if (Object.keys(props).length === 0) return { jobId, dealId, result: "skipped" as const }
  try {
    const res = await fetch(`${HS_DEAL_PATCH_BASE}/${dealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${HS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: props }),
    })
    if (!res.ok) {
      const t = await res.text()
      return { jobId, dealId, result: "failed" as const, error: `${res.status} ${t.slice(0, 200)}` }
    }
    return { jobId, dealId, result: "patched" as const }
  } catch (err) {
    return { jobId, dealId, result: "failed" as const, error: err instanceof Error ? err.message : String(err) }
  }
}

async function main() {
  console.log("=== Phase 1: backfill quotes ===")
  const { data: quotes, error: qErr } = await sb
    .from("quotes")
    .select(
      "quote_id, hubspot_deal_id, from_address, to_address, from_access, to_access, service_type, move_date, move_size, custom_price, tiers, est_crew_size, est_hours, truck_primary, recommended_tier, factors_applied, contact_id, contacts:contact_id(name)",
    )
    .not("hubspot_deal_id", "is", null)
  if (qErr) {
    console.error("Quote select error:", qErr)
    process.exit(1)
  }
  console.log(`  ${quotes?.length ?? 0} quotes with hubspot_deal_id`)

  const qEntries: { jobId: string; dealId: string; result: string; error?: string }[] = []
  for (const q of quotes ?? []) {
    const tiers = q.tiers as Record<string, { price?: number }> | null
    const price = tiers?.essential?.price ?? tiers?.curated?.price ?? Number(q.custom_price ?? 0) ?? null
    const contactRaw = (q as { contacts?: { name?: string | null } | { name?: string | null }[] | null }).contacts
    const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw
    const fullName = String(contact?.name ?? "").trim()
    const parts = fullName.split(/\s+/)
    const firstName = parts.shift() ?? ""
    const lastName = parts.join(" ")
    const props = buildAllDealProperties({
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
      // Business name lives in factors_applied JSONB on quotes (no top-level column).
      businessName:
        ((q.factors_applied as { b2b_business_name?: string; business_name?: string } | null)
          ?.b2b_business_name ??
          (q.factors_applied as { b2b_business_name?: string; business_name?: string } | null)
            ?.business_name) ||
        null,
    })
    qEntries.push(await patchDeal(q.hubspot_deal_id, q.quote_id, props))
  }

  console.log("=== Phase 2: backfill moves ===")
  const { data: moves, error: mErr } = await sb
    .from("moves")
    .select(
      "move_code, hubspot_deal_id, client_name, tenant_name, from_address, to_address, from_access, to_access, service_type, scheduled_date, move_size, estimate, amount, total_price, tier_selected, est_crew_size, est_hours, truck_primary, is_pm_move",
    )
    .not("hubspot_deal_id", "is", null)
  if (mErr) {
    console.error("Move select error:", mErr)
    process.exit(1)
  }
  console.log(`  ${moves?.length ?? 0} moves with hubspot_deal_id`)

  const mEntries: { jobId: string; dealId: string; result: string; error?: string }[] = []
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
    const props = buildAllDealProperties({
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
    mEntries.push(await patchDeal(m.hubspot_deal_id, m.move_code, props))
  }

  const all = [...qEntries, ...mEntries]
  const patched = all.filter((e) => e.result === "patched").length
  const failed = all.filter((e) => e.result === "failed").length
  const skipped = all.filter((e) => e.result === "skipped").length
  console.log(`\n=== Done: ${patched} patched, ${failed} failed, ${skipped} skipped ===`)
  if (failed > 0) {
    console.log("\nFailures:")
    for (const e of all.filter((x) => x.result === "failed")) {
      console.log(`  ${e.jobId} (${e.dealId}): ${e.error}`)
    }
  }
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
