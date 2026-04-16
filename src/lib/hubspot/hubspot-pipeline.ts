import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * HubSpot deals pipeline ID (custom pipeline, e.g. OPS+). Required with dealstage for non-default pipelines.
 * Set in platform_config `hubspot_pipeline_id` or env `HUBSPOT_PIPELINE_ID`.
 */
export async function resolveHubSpotPipelineId(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", "hubspot_pipeline_id")
    .maybeSingle();
  const v = data?.value?.trim();
  if (v) return v;
  const ev = process.env.HUBSPOT_PIPELINE_ID?.trim();
  return ev || null;
}
