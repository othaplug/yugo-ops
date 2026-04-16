import { LOGICAL_STAGE_PLATFORM_KEYS } from "@/lib/hubspot/logical-deal-stages"

const stageKeys = new Set<string>()
for (const ks of Object.values(LOGICAL_STAGE_PLATFORM_KEYS)) {
  for (const k of ks) stageKeys.add(k)
}

/** Keys stored in `platform_config` for HubSpot pipeline and deal stages (editable in admin). */
export const HUBSPOT_PLATFORM_CONFIG_KEYS = [
  "hubspot_pipeline_id",
  ...Array.from(stageKeys).sort(),
] as const

export type HubspotPlatformConfigKey = (typeof HUBSPOT_PLATFORM_CONFIG_KEYS)[number]
