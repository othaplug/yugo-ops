import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGICAL_STAGE_PLATFORM_KEYS } from "@/lib/hubspot/logical-deal-stages";

/**
 * Resolve a logical stage (e.g. quote_sent) to HubSpot's internal dealstage ID.
 */
export async function resolveHubSpotStageInternalId(
  sb: SupabaseClient,
  logicalStage: string,
): Promise<string | null> {
  const keys = LOGICAL_STAGE_PLATFORM_KEYS[logicalStage];
  if (!keys?.length) return null;

  for (const configKey of keys) {
    const { data } = await sb.from("platform_config").select("value").eq("key", configKey).maybeSingle();
    const v = data?.value?.trim();
    if (v) return v;
    const envKey = configKey.toUpperCase();
    const ev = process.env[envKey]?.trim();
    if (ev) return ev;
  }
  return null;
}
