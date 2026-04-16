import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGICAL_STAGE_PLATFORM_KEYS } from "@/lib/hubspot/logical-deal-stages";

/**
 * Resolve a logical stage (e.g. quote_sent) to HubSpot's internal dealstage ID.
 * If nothing is configured, logs a clear error (deal sync or creation will skip).
 */
export async function resolveHubSpotStageInternalId(
  sb: SupabaseClient,
  logicalStage: string,
): Promise<string | null> {
  const keys = LOGICAL_STAGE_PLATFORM_KEYS[logicalStage];
  if (!keys?.length) {
    console.error(
      `[HubSpot] Unknown logical stage "${logicalStage}". ` +
        `Add it to LOGICAL_STAGE_PLATFORM_KEYS or fix the trigger mapping.`,
    );
    return null;
  }

  for (const configKey of keys) {
    const { data } = await sb.from("platform_config").select("value").eq("key", configKey).maybeSingle();
    const v = data?.value?.trim();
    if (v) return v;
    const envKey = configKey.toUpperCase();
    const ev = process.env[envKey]?.trim();
    if (ev) return ev;
  }

  const tried = keys.map((k) => `${k} / ${k.toUpperCase()}`).join(", ");
  console.error(
    `[HubSpot] MISSING STAGE CONFIG for logical stage "${logicalStage}". ` +
      `Tried: ${tried}. ` +
      `Set these in platform_config (App Settings, HubSpot) or environment. ` +
      `Deal creation or stage sync will skip until configured.`,
  )
  return null
}
