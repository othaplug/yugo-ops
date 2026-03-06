import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side Square config for payment form (app ID, location ID).
 * Resolution order: env vars → platform_config DB table.
 */
export async function getSquarePaymentConfig(): Promise<{
  appId: string;
  locationId: string;
}> {
  let appId = (
    process.env.NEXT_PUBLIC_SQUARE_APP_ID ??
    process.env.SQUARE_APP_ID ??
    ""
  ).trim();
  let locationId = (
    process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ??
    process.env.SQUARE_LOCATION_ID ??
    ""
  ).trim();

  if (appId && locationId) {
    return { appId, locationId };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_config")
      .select("key, value")
      .in("key", ["square_app_id", "square_location_id"]);

    if (error) {
      console.error("[square-config] DB lookup failed:", error.message);
    }

    const cfg: Record<string, string> = {};
    if (data) for (const row of data) cfg[row.key] = (row.value ?? "").trim();
    if (!appId) appId = cfg.square_app_id ?? "";
    if (!locationId) locationId = cfg.square_location_id ?? "";
  } catch (err) {
    console.error("[square-config] Unexpected error reading platform_config:", err);
  }

  return { appId, locationId };
}
