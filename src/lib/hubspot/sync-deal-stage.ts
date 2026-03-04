import { createAdminClient } from "@/lib/supabase/admin";

const HS_DEALS = "https://api.hubapi.com/crm/v3/objects/deals";

/**
 * Stage mapping: OPS+ move status → platform_config key for the HubSpot
 * pipeline stage internal ID. Falls back to env vars if the DB row is missing.
 */
const STATUS_TO_CONFIG_KEY: Record<string, string> = {
  quote_sent:  "hubspot_stage_quote_sent",
  confirmed:   "hubspot_stage_deposit_received",
  scheduled:   "hubspot_stage_booked",
  in_progress: "hubspot_stage_booked",
  completed:   "hubspot_stage_closed_won",
  paid:        "hubspot_stage_closed_won",
};

/**
 * Sync a move's status change to the linked HubSpot deal.
 *
 * Call this **after** you update the status in Supabase.
 * It's fire-and-forget: failures are logged but never block the caller.
 *
 * @param hubspotDealId  The deal ID from `moves.hubspot_deal_id` (null = skip)
 * @param newStatus      The new OPS+ move status value
 */
export async function syncDealStage(
  hubspotDealId: string | null | undefined,
  newStatus: string,
): Promise<void> {
  if (!hubspotDealId) return;

  const configKey = STATUS_TO_CONFIG_KEY[newStatus];
  if (!configKey) return; // not a status we push to HubSpot

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  try {
    const sb = createAdminClient();

    // Resolve the HubSpot internal stage ID from platform_config → env fallback
    let stageId: string | undefined;
    const { data } = await sb
      .from("platform_config")
      .select("value")
      .eq("key", configKey)
      .single();

    stageId = data?.value || process.env[configKey.toUpperCase()] || undefined;
    if (!stageId) return; // stage not configured yet

    const properties: Record<string, string> = { dealstage: stageId };
    if (newStatus === "completed" || newStatus === "paid") {
      properties.closedate = new Date().toISOString();
    }

    const res = await fetch(`${HS_DEALS}/${hubspotDealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    // Log the sync attempt for debugging
    try {
      await sb.from("webhook_logs").insert({
        source: "hubspot_deal_stage_sync",
        event_type: `stage_sync:${newStatus}`,
        payload: {
          deal_id: hubspotDealId,
          new_status: newStatus,
          stage_id: stageId,
          hs_status: res.status,
        },
        status: res.ok ? "success" : "error",
        error: res.ok ? null : `HubSpot responded ${res.status}`,
      });
    } catch {
      // ignore log failure
    }
  } catch (err) {
    // Log but never block the calling operation
    try {
      const sb = createAdminClient();
      await sb.from("webhook_logs").insert({
        source: "hubspot_deal_stage_sync",
        event_type: `stage_sync:${newStatus}`,
        payload: { deal_id: hubspotDealId, new_status: newStatus },
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } catch {
      console.error("[syncDealStage] failed:", err);
    }
  }
}

/**
 * Convenience: fetch a move's `hubspot_deal_id` by its ID, then sync.
 * Use this in routes that only have the move ID in scope.
 */
export async function syncDealStageByMoveId(
  moveId: string,
  newStatus: string,
): Promise<void> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("moves")
      .select("hubspot_deal_id")
      .eq("id", moveId)
      .single();
    if (data?.hubspot_deal_id) {
      await syncDealStage(data.hubspot_deal_id, newStatus);
    }
  } catch {
    // never block
  }
}
