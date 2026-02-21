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
