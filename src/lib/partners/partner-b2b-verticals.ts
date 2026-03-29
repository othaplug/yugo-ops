import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type OnboardingVerticalRow = {
  vertical_code: string;
  use_defaults?: boolean;
  custom_rates?: Record<string, unknown>;
};

/**
 * Persists partner_vertical_rates from onboarding (one row per enabled vertical).
 * use_defaults: true → empty custom_rates (platform vertical defaults apply).
 */
export async function upsertPartnerB2BVerticalsFromOnboarding(
  admin: Admin,
  organizationId: string,
  rows: unknown,
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const code = String(o.vertical_code || o.code || "").trim();
    if (!code) continue;
    const useDefaults = o.use_defaults !== false;
    let custom_rates: Record<string, unknown> = {};
    if (!useDefaults && o.custom_rates && typeof o.custom_rates === "object" && !Array.isArray(o.custom_rates)) {
      custom_rates = o.custom_rates as Record<string, unknown>;
    }
    await admin.from("partner_vertical_rates").upsert(
      {
        organization_id: organizationId,
        vertical_code: code,
        custom_rates,
        active: true,
      },
      { onConflict: "organization_id,vertical_code" },
    );
  }
}

export async function listPartnerB2BVerticals(
  admin: Admin,
  organizationId: string,
): Promise<{ code: string; name: string }[]> {
  const { data: rates } = await admin
    .from("partner_vertical_rates")
    .select("vertical_code")
    .eq("organization_id", organizationId)
    .eq("active", true);
  const codes = (rates ?? []).map((r) => String((r as { vertical_code?: string }).vertical_code || "")).filter(Boolean);
  if (codes.length === 0) return [];
  const { data: verts } = await admin
    .from("delivery_verticals")
    .select("code, name")
    .in("code", codes)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (verts ?? []).map((v) => ({ code: String(v.code), name: String(v.name) }));
}
