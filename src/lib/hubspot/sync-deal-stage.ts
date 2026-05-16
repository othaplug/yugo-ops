import { createAdminClient } from "@/lib/supabase/admin";
import { LOGICAL_STAGE_PLATFORM_KEYS, YUGO_TRIGGER_TO_LOGICAL_STAGE } from "@/lib/hubspot/logical-deal-stages";
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";

const HS_DEALS = "https://api.hubapi.com/crm/v3/objects/deals";

function stringifyHubSpotProps(extra: Record<string, string | number | boolean> | undefined): Record<string, string> {
  if (!extra) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "boolean" ? (v ? "true" : "false") : String(v);
  }
  return out;
}

/**
 * Sync a HubSpot deal stage (and optional properties) from a Yugo lifecycle trigger.
 *
 * @param hubspotDealId   Deal ID from quotes/moves/deliveries
 * @param yugoTrigger     e.g. sent, viewed, confirmed, scheduled, completed, cancelled, expired, quote_sent
 * @param extraProperties Additional deal properties (HubSpot string values)
 * @param moveDate        YYYY-MM-DD or ISO date for the actual move/job date — used as closedate on booking/completion
 */
export async function syncDealStage(
  hubspotDealId: string | null | undefined,
  yugoTrigger: string,
  extraProperties?: Record<string, string | number | boolean>,
  moveDate?: string | null,
): Promise<void> {
  if (!hubspotDealId?.trim()) return;

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  const logical =
    YUGO_TRIGGER_TO_LOGICAL_STAGE[yugoTrigger] ??
    (LOGICAL_STAGE_PLATFORM_KEYS[yugoTrigger] ? yugoTrigger : null);
  if (!logical) return;

  try {
    const sb = createAdminClient();
    const stageId = await resolveHubSpotStageInternalId(sb, logical);
    if (!stageId) {
      return
    }

    const pipelineId = await resolveHubSpotPipelineId(sb);
    if (!pipelineId) {
      console.error(
        "[HubSpot] hubspot_pipeline_id is not set. Stage updates may fail for deals in a custom pipeline.",
      )
    }
    const properties: Record<string, string> = {
      ...(pipelineId ? { pipeline: pipelineId } : {}),
      dealstage: stageId,
      ...stringifyHubSpotProps(extraProperties),
    };

    const resolveMoveDate = (): string => {
      if (moveDate) {
        const d = new Date(moveDate);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
      return new Date().toISOString();
    };

    if (
      logical === "closed_won" ||
      yugoTrigger === "completed" ||
      yugoTrigger === "paid" ||
      yugoTrigger === "scheduled" ||
      yugoTrigger === "confirmed"
    ) {
      properties.closedate = resolveMoveDate();
    }
    if (
      logical === "closed_lost" &&
      (yugoTrigger === "cancelled" ||
        yugoTrigger === "expired" ||
        yugoTrigger === "declined" ||
        yugoTrigger === "lost")
    ) {
      properties.closedate = new Date().toISOString();
    }

    const res = await fetch(`${HS_DEALS}/${hubspotDealId.trim()}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    try {
      await sb.from("webhook_logs").insert({
        source: "hubspot_deal_stage_sync",
        event_type: `stage_sync:${yugoTrigger}`,
        payload: {
          deal_id: hubspotDealId,
          yugo_trigger: yugoTrigger,
          logical_stage: logical,
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
    try {
      const sb = createAdminClient();
      await sb.from("webhook_logs").insert({
        source: "hubspot_deal_stage_sync",
        event_type: `stage_sync:${yugoTrigger}`,
        payload: { deal_id: hubspotDealId, yugo_trigger: yugoTrigger },
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } catch {
      console.error("[syncDealStage] failed:", err);
    }
  }
}

/**
 * Map a B2B delivery `status` (and optional `stage`) to a syncDealStage trigger, or null to skip.
 */
export function deliveryStatusToHubspotTrigger(statusRaw: string | null | undefined): string | null {
  const s = (statusRaw || "").toLowerCase().replace(/-/g, "_");
  if (!s || s === "pending_approval" || s === "draft") return null;
  if (s === "cancelled") return "cancelled";
  if (s === "completed" || s === "delivered") return "completed";
  if (
    s === "dispatched" ||
    s === "in_transit" ||
    s === "en_route" ||
    s === "en_route_to_pickup" ||
    s === "en_route_to_destination" ||
    s === "arrived_at_pickup" ||
    s === "arrived_at_destination" ||
    s === "loading" ||
    s === "unloading" ||
    s === "in_progress"
  ) {
    return "in_progress";
  }
  if (s === "confirmed" || s === "scheduled") return "scheduled";
  return null;
}

export async function syncDealStageByMoveId(moveId: string, newStatus: string): Promise<void> {
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("moves").select("hubspot_deal_id, scheduled_date").eq("id", moveId).single();
    if (data?.hubspot_deal_id) {
      await syncDealStage(data.hubspot_deal_id, newStatus, undefined, data.scheduled_date as string | null);
    }
  } catch {
    // never block
  }
}

export async function syncDealStageByDeliveryId(deliveryId: string, status: string | null | undefined): Promise<void> {
  try {
    const trigger = deliveryStatusToHubspotTrigger(status);
    if (!trigger) return;
    const sb = createAdminClient();
    const { data } = await sb.from("deliveries").select("hubspot_deal_id").eq("id", deliveryId).maybeSingle();
    if (data?.hubspot_deal_id) {
      await syncDealStage(data.hubspot_deal_id, trigger);
    }
  } catch {
    // never block
  }
}
