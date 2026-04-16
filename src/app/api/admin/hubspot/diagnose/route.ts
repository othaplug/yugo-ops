import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"
import { HUBSPOT_PLATFORM_CONFIG_KEYS } from "@/lib/hubspot/hubspot-config-keys"

export async function GET() {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  const results: Record<string, unknown> = {}
  const token = process.env.HUBSPOT_ACCESS_TOKEN
  results.token_exists = Boolean(token)
  results.token_prefix = token ? `${token.substring(0, 8)}...` : "MISSING"

  if (token) {
    try {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/deals?limit=1", {
        headers: { Authorization: `Bearer ${token}` },
      })
      results.token_valid = response.ok
      results.token_status = response.status
      if (!response.ok) {
        results.token_error = await response.text()
      }
    } catch (err) {
      results.token_valid = false
      results.token_error = String(err)
    }
  }

  const sb = createAdminClient()
  const { data: configs } = await sb
    .from("platform_config")
    .select("key, value")
    .like("key", "hubspot_%")

  const configValues: Record<string, string> = {}
  for (const c of configs || []) {
    if (c.key) configValues[c.key] = (c.value ?? "").trim() || "NOT SET"
  }
  results.config_values = configValues

  const pipelineId = configValues.hubspot_pipeline_id
  if (pipelineId && pipelineId !== "NOT SET" && token) {
    try {
      const response = await fetch(`https://api.hubapi.com/crm/v3/pipelines/deals/${pipelineId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      results.pipeline_valid = response.ok
      results.pipeline_status = response.status
      if (response.ok) {
        const pipeline = (await response.json()) as {
          label?: string
          stages?: { id: string; label: string; displayOrder?: number }[]
        }
        results.pipeline_name = pipeline.label
        results.pipeline_stages = (pipeline.stages ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          order: s.displayOrder,
        }))
      } else {
        results.pipeline_error = await response.text()
      }
    } catch (err) {
      results.pipeline_valid = false
      results.pipeline_error = String(err)
    }
  }

  const { data: recentQuotes } = await sb
    .from("quotes")
    .select("quote_id, hubspot_deal_id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(10)

  results.recent_quotes = (recentQuotes ?? []).map((q) => ({
    quote_id: q.quote_id,
    has_deal: Boolean(q.hubspot_deal_id),
    deal_id: q.hubspot_deal_id || "NONE",
    status: q.status,
  }))

  const quoteSent = configValues.hubspot_stage_quote_sent
  const blockers: string[] = []
  if (!token) blockers.push("HUBSPOT_ACCESS_TOKEN missing from environment")
  if (!pipelineId || pipelineId === "NOT SET") blockers.push("hubspot_pipeline_id not set in platform_config")
  if (!quoteSent || quoteSent === "NOT SET") {
    blockers.push("hubspot_stage_quote_sent not set in platform_config")
  }

  results.summary = {
    can_create_deals: Boolean(
      token && pipelineId && pipelineId !== "NOT SET" && quoteSent && quoteSent !== "NOT SET",
    ),
    blockers,
    expected_config_keys: HUBSPOT_PLATFORM_CONFIG_KEYS,
  }

  return NextResponse.json(results)
}
