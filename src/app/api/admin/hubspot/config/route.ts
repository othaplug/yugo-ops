import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"
import { requireOwner } from "@/lib/auth/check-role"
import { HUBSPOT_PLATFORM_CONFIG_KEYS, type HubspotPlatformConfigKey } from "@/lib/hubspot/hubspot-config-keys"

const KEY_SET = new Set<string>(HUBSPOT_PLATFORM_CONFIG_KEYS)

function isHubspotKey(k: string): k is HubspotPlatformConfigKey {
  return KEY_SET.has(k)
}

/** GET: HubSpot-related platform_config rows (staff). */
export async function GET() {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("platform_config")
      .select("key, value, description")
      .in("key", [...HUBSPOT_PLATFORM_CONFIG_KEYS])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const byKey: Record<string, { value: string; description: string | null }> = {}
    for (const k of HUBSPOT_PLATFORM_CONFIG_KEYS) {
      byKey[k] = { value: "", description: null }
    }
    for (const row of data ?? []) {
      if (row.key && isHubspotKey(row.key)) {
        byKey[row.key] = { value: row.value ?? "", description: row.description ?? null }
      }
    }
    return NextResponse.json({ keys: byKey })
  } catch (e) {
    console.error("[hubspot/config] GET error:", e)
    return NextResponse.json({ error: "Failed to load HubSpot config" }, { status: 500 })
  }
}

/** PATCH: Update HubSpot platform_config keys (owner only). Body: { "hubspot_pipeline_id": "...", ... } */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner()
  if (authErr) return authErr

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const entries = Object.entries(raw).filter(([k]) => isHubspotKey(k))
  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid HubSpot keys in body" }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    for (const [key, val] of entries) {
      if (typeof val !== "string") {
        return NextResponse.json({ error: `Value for ${key} must be a string` }, { status: 400 })
      }
      const { error } = await admin
        .from("platform_config")
        .upsert({ key, value: val.trim() }, { onConflict: "key" })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, updated: entries.length })
  } catch (e) {
    console.error("[hubspot/config] PATCH error:", e)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
