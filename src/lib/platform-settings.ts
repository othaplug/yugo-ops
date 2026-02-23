import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformToggles {
  crew_tracking: boolean;
  partner_portal: boolean;
  auto_invoicing: boolean;
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
