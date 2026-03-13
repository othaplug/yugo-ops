import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformToggles {
  crew_tracking: boolean;
  partner_portal: boolean;
  auto_invoicing: boolean;
}

export interface OfficeLocation {
  lat: number;
  lng: number;
  address: string;
  radiusM: number;
}

const DEFAULTS: PlatformToggles = {
  crew_tracking: true,
  partner_portal: false,
  auto_invoicing: true,
};

/** Server-side: read platform toggles from DB. Uses admin client. */
export async function getPlatformToggles(): Promise<PlatformToggles> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("crew_tracking, partner_portal, auto_invoicing")
      .eq("id", "default")
      .maybeSingle();
    if (data && typeof data.crew_tracking === "boolean" && typeof data.partner_portal === "boolean" && typeof data.auto_invoicing === "boolean") {
      return {
        crew_tracking: data.crew_tracking,
        partner_portal: data.partner_portal,
        auto_invoicing: data.auto_invoicing,
      };
    }
  } catch (_) {}
  return DEFAULTS;
}

const DEFAULT_OFFICE: OfficeLocation = {
  lat: 43.66027,
  lng: -79.35365,
  address: "50 Carroll St, Toronto, ON M4M 3G3",
  radiusM: 200,
};

/** Server-side: read office/HQ location from platform_settings. */
export async function getOfficeLocation(): Promise<OfficeLocation> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("office_lat, office_lng, office_address, office_radius_m")
      .eq("id", "default")
      .maybeSingle();
    if (data && typeof data.office_lat === "number" && typeof data.office_lng === "number") {
      return {
        lat: data.office_lat,
        lng: data.office_lng,
        address: data.office_address || DEFAULT_OFFICE.address,
        radiusM: data.office_radius_m || DEFAULT_OFFICE.radiusM,
      };
    }
  } catch { /* use defaults */ }
  return DEFAULT_OFFICE;
}

/** Feature config defaults (from platform_config key-value table) */
const FEATURE_DEFAULTS: Record<string, string> = {
  tipping_enabled: "true",
  quote_engagement_tracking: "true",
  instant_quote_widget: "false",
  valuation_upgrades: "true",
  auto_followup_enabled: "true",
  followup_max_attempts: "3",
  sms_eta_enabled: "false",
};

/**
 * Server-side: read one or more feature flags from platform_config.
 * Returns the value as a string, or the default if not found.
 */
export async function getFeatureConfig(keys: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const k of keys) result[k] = FEATURE_DEFAULTS[k] ?? "false";

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", keys);
    if (data) {
      for (const row of data) {
        result[row.key] = row.value ?? FEATURE_DEFAULTS[row.key] ?? "false";
      }
    }
  } catch { /* use defaults */ }
  return result;
}

/** Convenience: check a single boolean feature flag. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const cfg = await getFeatureConfig([key]);
  return cfg[key] === "true";
}

const DEFAULT_READINESS_ITEMS = [
  { label: "Truck in good condition" },
  { label: "Equipment & supplies ready" },
  { label: "Dolly, straps, blankets" },
  { label: "First aid kit accessible" },
  { label: "Fuel level adequate" },
];

/** Server-side: read readiness checklist items from platform_settings. */
export async function getReadinessItems(): Promise<{ label: string }[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_settings")
      .select("readiness_items")
      .eq("id", "default")
      .maybeSingle();
    const items = (data as { readiness_items?: unknown })?.readiness_items;
    if (Array.isArray(items) && items.length > 0) {
      return items
        .filter((i): i is { label: string } => i && typeof i === "object" && typeof (i as { label?: unknown }).label === "string")
        .map((i) => ({ label: (i as { label: string }).label }));
    }
  } catch (_) {}
  return DEFAULT_READINESS_ITEMS;
}
