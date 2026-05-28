import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder"
import { buildHubSpotDealName } from "@/lib/hubspot/deal-name"
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write"
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage"

/**
 * Hourly self-healing HubSpot deal sync.
 *
 * Syncs ALL quotes and moves that have a hubspot_deal_id — no time-window
 * filter. At current volumes (~25–50 deals) the full pass runs in < 10s
 * and is well within HubSpot's rate limits (120ms delay → ~8 req/s vs
 * 100 req/10s limit). PATCHing the same values is a no-op in HubSpot,
 * so re-confirming correct state is always safe.
 *
 * Beyond patching OPS+ Detail properties, this cron also syncs each
 * deal's stage from the current DB status. This catches deals whose
 * live stage-sync hook never fired (e.g. moves created from quotes
 * before the quote's hubspot_deal_id was inherited onto the move).
 *
 * Schedule: `0 * * * *` (top of every hour) — see vercel.json.
 */

const HUBSPOT_RATE_LIMIT_DELAY_MS = 120 // ~8 req/s — well under 100 req / 10s

/** Map a quote DB status to the yugoTrigger to pass to syncDealStage. */
function quoteStageFromStatus(status: string | null | undefined): string | null {
  const s = String(status ?? "").toLowerCase()
  if (s === "booked" || s === "accepted") return "confirmed"
  if (s === "cancelled") return "cancelled"
  if (s === "declined" || s === "lost") return "lost"
  if (s === "expired") return "expired"
  // sent / viewed / draft — already handled by live hooks on the way in; skip
  return null
}

/** Map a move DB status to the yugoTrigger to pass to syncDealStage. */
function moveStageFromStatus(status: string | null | undefined): string | null {
  const s = String(status ?? "").toLowerCase().replace(/-/g, "_")
  if (["completed", "delivered", "paid", "final_payment_received"].includes(s))
    return "completed"
  if (["in_progress", "dispatched", "in_transit"].includes(s)) return "in_progress"
  if (["confirmed", "booked", "scheduled"].includes(s)) return "confirmed"
  if (s === "cancelled") return "cancelled"
  return null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "HUBSPOT_ACCESS_TOKEN not set" },
      { status: 503 },
    )
  }

  const sb = createAdminClient()

  const results = {
    quotes_synced: 0,
    moves_synced: 0,
    deal_ids_propagated: 0,
    stages_synced: 0,
    failures: 0,
    errors: [] as string[],
  }

  // ── Propagate deal IDs from quotes → moves ─────────────────────────
  // Moves created before their quote's hubspot_deal_id was set (or where
  // the quote's deal was created later via the retry button) have a NULL
  // hubspot_deal_id even though their source quote has one. Find and fix.
  const { data: orphanMoves } = await sb
    .from("moves")
    .select("id, move_code, status, scheduled_date, quote_id")
    .is("hubspot_deal_id", null)
    .not("quote_id", "is", null)

  for (const m of orphanMoves ?? []) {
    try {
      if (!m.quote_id) continue
      const { data: q } = await sb
        .from("quotes")
        .select("hubspot_deal_id")
        .eq("id", m.quote_id)
        .single()
      const dealId = (q?.hubspot_deal_id as string | null | undefined)
      if (!dealId) continue

      // Write deal ID onto the move so subsequent runs and live hooks work.
      await sb.from("moves").update({ hubspot_deal_id: dealId }).eq("id", m.id)

      // Immediately sync the deal to the move's actual current stage.
      const stageTrigger = moveStageFromStatus(m.status)
      if (stageTrigger) {
        await syncDealStage(dealId, stageTrigger, undefined, m.scheduled_date ?? null).catch(() => {})
        results.stages_synced++
      }

      results.deal_ids_propagated++
    } catch (err) {
      results.errors.push(`propagate ${m.move_code}: ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, HUBSPOT_RATE_LIMIT_DELAY_MS))
  }

  // ── Quotes ─────────────────────────────────────────────────────────
  // No updated_at filter — sync every quote with a deal ID so properties
  // and stage are always up to date regardless of when it was last touched.
  const { data: quotes, error: qErr } = await sb
    .from("quotes")
    .select(
      "quote_id, status, hubspot_deal_id, from_address, to_address, from_access, to_access, service_type, move_date, move_size, custom_price, tiers, est_crew_size, est_hours, truck_primary, recommended_tier, factors_applied, contact_id, contacts:contact_id(name)",
    )
    .not("hubspot_deal_id", "is", null)

  if (qErr) {
    return NextResponse.json({ ok: false, error: qErr.message }, { status: 500 })
  }

  for (const q of quotes ?? []) {
    try {
      const tiers = q.tiers as Record<string, { price?: number }> | null
      const price =
        tiers?.essential?.price ?? tiers?.curated?.price ?? Number(q.custom_price ?? 0) ?? null
      const contactRaw = (q as { contacts?: { name?: string | null } | { name?: string | null }[] | null }).contacts
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw
      const fullName = String(contact?.name ?? "").trim()
      const parts = fullName.split(/\s+/)
      const firstName = parts.shift() ?? ""
      const lastName = parts.join(" ")
      const factors =
        (q.factors_applied as { b2b_business_name?: string; business_name?: string } | null) ?? null
      const businessName = factors?.b2b_business_name ?? factors?.business_name ?? null

      const dealName = buildHubSpotDealName({
        serviceType: q.service_type as string | null | undefined,
        isPmMove: false,
        firstName,
        lastName,
        businessName: businessName ?? undefined,
        tierLabel: (q.recommended_tier as string | null | undefined) ?? undefined,
        moveSize: (q.move_size as string | null | undefined) ?? undefined,
        fromAddress: (q.from_address as string | null | undefined) ?? undefined,
        fallbackCode: `Quote ${q.quote_id}`,
      })

      const props: Record<string, string> = {
        dealname: dealName,
        ...buildAllDealProperties({
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
          businessName,
        }),
      }

      const res = await safePatchDeal(token, q.hubspot_deal_id, props)
      if (res.ok || res.status === 204) {
        results.quotes_synced++
      } else {
        results.failures++
        results.errors.push(`${q.quote_id}: HTTP ${res.status}`)
      }

      // Sync deal stage from current quote status (skips sent/viewed/draft
      // since those are handled by live hooks and don't need backfilling).
      const stageTrigger = quoteStageFromStatus(q.status)
      if (stageTrigger) {
        await syncDealStage(q.hubspot_deal_id, stageTrigger, undefined, q.move_date ?? null).catch(
          () => {},
        )
        results.stages_synced++
      }
    } catch (err) {
      results.failures++
      results.errors.push(`${q.quote_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, HUBSPOT_RATE_LIMIT_DELAY_MS))
  }

  // ── Moves ──────────────────────────────────────────────────────────
  const { data: moves, error: mErr } = await sb
    .from("moves")
    .select(
      "move_code, status, hubspot_deal_id, client_name, tenant_name, from_address, to_address, from_access, to_access, service_type, scheduled_date, move_size, estimate, amount, total_price, tier_selected, est_crew_size, est_hours, truck_primary, is_pm_move",
    )
    .not("hubspot_deal_id", "is", null)

  if (mErr) {
    return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 })
  }

  for (const m of moves ?? []) {
    try {
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
      const dealName = buildHubSpotDealName({
        serviceType: m.service_type as string | null | undefined,
        isPmMove: !!m.is_pm_move,
        firstName: fn,
        lastName: ln,
        tierLabel: (m.tier_selected as string | null | undefined) ?? undefined,
        moveSize: (m.move_size as string | null | undefined) ?? undefined,
        fromAddress: (m.from_address as string | null | undefined) ?? undefined,
        fallbackCode: `Move ${m.move_code}`,
      })

      const props: Record<string, string> = {
        dealname: dealName,
        ...buildAllDealProperties({
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
        }),
      }

      const res = await safePatchDeal(token, m.hubspot_deal_id, props)
      if (res.ok || res.status === 204) {
        results.moves_synced++
      } else {
        results.failures++
        results.errors.push(`${m.move_code}: HTTP ${res.status}`)
      }

      // Sync deal stage from current move status.
      const stageTrigger = moveStageFromStatus(m.status)
      if (stageTrigger) {
        await syncDealStage(
          m.hubspot_deal_id,
          stageTrigger,
          undefined,
          m.scheduled_date ?? null,
        ).catch(() => {})
        results.stages_synced++
      }
    } catch (err) {
      results.failures++
      results.errors.push(`${m.move_code}: ${err instanceof Error ? err.message : String(err)}`)
    }
    await new Promise((r) => setTimeout(r, HUBSPOT_RATE_LIMIT_DELAY_MS))
  }

  // ── Audit trail ─────────────────────────────────────────────────────
  await sb
    .from("webhook_logs")
    .insert({
      source: "cron_hubspot_deal_sync",
      event_type: results.failures > 0 ? "partial_failure" : "ok",
      payload: {
        quotes_synced: results.quotes_synced,
        moves_synced: results.moves_synced,
        deal_ids_propagated: results.deal_ids_propagated,
        stages_synced: results.stages_synced,
        failures: results.failures,
        errors: results.errors.slice(0, 25),
      },
      status: results.failures > 0 ? "error" : "ok",
      error: results.failures > 0 ? results.errors.slice(0, 5).join("; ").slice(0, 500) : null,
    })
    .then(
      () => {},
      () => {},
    )

  return NextResponse.json({ ok: true, ...results })
}
