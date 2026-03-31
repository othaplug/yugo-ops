import type { createAdminClient } from "@/lib/supabase/admin";
import { overlayDeliveryVerticalDbColumns } from "@/lib/admin/delivery-vertical-column-sync";
import {
  type DeliveryVerticalRow,
  mergeVerticalConfig,
} from "@/lib/pricing/b2b-dimensional";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function mapVerticalRow(row: Record<string, unknown>): DeliveryVerticalRow {
  const dc = row.default_config;
  return {
    id: String(row.id ?? ""),
    code: String(row.code ?? "custom"),
    name: String(row.name ?? "Custom"),
    description: row.description != null ? String(row.description) : null,
    icon: row.icon != null ? String(row.icon) : null,
    base_rate: Number(row.base_rate ?? 350),
    pricing_method: String(row.pricing_method ?? "dimensional"),
    default_config:
      dc && typeof dc === "object" && !Array.isArray(dc)
        ? (dc as Record<string, unknown>)
        : {},
    active: row.active !== false,
    sort_order: Number(row.sort_order ?? 0),
  };
}

export async function loadB2BVerticalPricing(
  sb: SupabaseAdmin,
  verticalCode: string | undefined,
  partnerOrganizationId: string | undefined | null,
): Promise<{ vertical: DeliveryVerticalRow; mergedRates: Record<string, unknown> } | null> {
  const code = (verticalCode || "custom").trim() || "custom";
  const { data: primary } = await sb
    .from("delivery_verticals")
    .select("*")
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  let row = primary;
  if (!row && code !== "custom") {
    const { data: fb } = await sb
      .from("delivery_verticals")
      .select("*")
      .eq("code", "custom")
      .eq("active", true)
      .maybeSingle();
    row = fb;
  }
  if (!row) return null;

  let vertical = mapVerticalRow(row as Record<string, unknown>);
  let mergedRates: Record<string, unknown> = { ...vertical.default_config };
  overlayDeliveryVerticalDbColumns(row as Record<string, unknown>, mergedRates);

  if (partnerOrganizationId) {
    const { data: pr } = await sb
      .from("partner_vertical_rates")
      .select("custom_rates")
      .eq("organization_id", partnerOrganizationId)
      .eq("vertical_code", vertical.code)
      .eq("active", true)
      .maybeSingle();
    const cr = pr?.custom_rates;
    if (cr && typeof cr === "object" && !Array.isArray(cr)) {
      const cro = cr as Record<string, unknown>;
      mergedRates = mergeVerticalConfig(mergedRates, cro);
      const br = cro.base_rate;
      if (typeof br === "number" && Number.isFinite(br)) {
        vertical = { ...vertical, base_rate: br };
      }
    }
  }

  return { vertical, mergedRates };
}
