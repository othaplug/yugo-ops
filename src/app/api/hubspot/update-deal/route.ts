import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

const HS_BASE = "https://api.hubapi.com/crm/v3/objects/deals";

/**
 * Map human-readable stage names → HubSpot internal pipeline stage IDs.
 * Populate these from HubSpot → Settings → Objects → Deals → Pipelines.
 * Each stage's internal ID is visible in the URL when you click on it.
 *
 * Stored in platform_config so admins can update without redeployment.
 * Fallback env vars are checked if the DB row doesn't exist.
 */
const STAGE_CONFIG_KEYS: Record<string, string> = {
  new_lead:          "hubspot_stage_new_lead",
  contacted:         "hubspot_stage_contacted",
  quote_sent:        "hubspot_stage_quote_sent",
  deposit_received:  "hubspot_stage_deposit_received",
  booked:            "hubspot_stage_booked",
  closed_won:        "hubspot_stage_closed_won",
  closed_lost:       "hubspot_stage_closed_lost",
};

const ALLOWED_PROPERTIES = new Set([
  "amount",
  "total_price",
  "taxes",
  "quote_url",
  "opsplus_move_id",
  "square_invoice_id",
  "deposit_received_at",
  "contract_signed",
  "package_type",
  "dealstage",
  // Deal fields synced from Yugo+ (match get-deal / HubSpot deal property internal names)
  "firstname",
  "lastname",
  "pick_up_address",
  "drop_off_address",
  "access_from",
  "access_to",
  "service_type",
  "move_size",
  "move_date",
]);

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  let body: { dealId?: string; properties?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { dealId, properties } = body;
  if (!dealId || !properties || typeof properties !== "object") {
    return NextResponse.json(
      { error: "dealId (string) and properties (object) are required" },
      { status: 400 },
    );
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  const sb = createAdminClient();

  // ── Resolve deal stage names to HubSpot internal IDs ──
  const hsProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTIES.has(key)) continue;

    if (key === "dealstage" && typeof value === "string") {
      const resolved = await resolveDealStage(sb, value);
      if (resolved) {
        hsProps.dealstage = resolved;
      } else {
        hsProps.dealstage = value;
      }
      continue;
    }

    if (key === "contract_signed") {
      hsProps[key] = value ? "true" : "false";
      continue;
    }

    hsProps[key] = value;
  }

  if (Object.keys(hsProps).length === 0) {
    return NextResponse.json({ error: "No valid properties to update" }, { status: 400 });
  }

  try {
    const hsRes = await fetch(`${HS_BASE}/${dealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: hsProps }),
    });

    const hsBody = await hsRes.text();
    let hsJson: Record<string, unknown> | null = null;
    try { hsJson = JSON.parse(hsBody); } catch { /* plain text error */ }

    // ── Log to webhook_logs for audit / debugging ──
    await sb.from("webhook_logs").insert({
      source: "hubspot_deal_update",
      event_type: `deal_update:${dealId}`,
      payload: {
        deal_id: dealId,
        properties_sent: hsProps,
        hs_status: hsRes.status,
        hs_response: hsJson ?? hsBody,
      },
      status: hsRes.ok ? "success" : "error",
      error: hsRes.ok ? null : (typeof hsJson === "object" && hsJson?.message ? String(hsJson.message) : hsBody),
    });

    if (hsRes.status === 404) {
      return NextResponse.json({ error: `Deal ${dealId} not found in HubSpot` }, { status: 404 });
    }
    if (hsRes.status === 429) {
      const retryAfter = hsRes.headers.get("Retry-After") || "10";
      return NextResponse.json(
        { error: "HubSpot rate limit exceeded" },
        { status: 429, headers: { "Retry-After": retryAfter } },
      );
    }
    if (!hsRes.ok) {
      return NextResponse.json(
        { error: `HubSpot ${hsRes.status}: ${hsBody}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      dealId,
      updatedProperties: Object.keys(hsProps),
    });
  } catch (err: unknown) {
    try {
      await sb.from("webhook_logs").insert({
        source: "hubspot_deal_update",
        event_type: `deal_update:${dealId}`,
        payload: { deal_id: dealId, properties_sent: hsProps },
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } catch {
      // ignore log failure
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update deal" },
      { status: 500 },
    );
  }
}

/**
 * Resolve a friendly stage name (e.g. "quote_sent") to its HubSpot
 * internal stage ID by checking platform_config first, then env vars.
 * Returns null if the value is already an opaque ID (not in our map).
 */
async function resolveDealStage(
  sb: ReturnType<typeof createAdminClient>,
  value: string,
): Promise<string | null> {
  const configKey = STAGE_CONFIG_KEYS[value];
  if (!configKey) return null; // already an internal ID or unknown

  const { data } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", configKey)
    .single();

  if (data?.value) return data.value;

  const envKey = configKey.toUpperCase();
  if (process.env[envKey]) return process.env[envKey]!;

  return null;
}
