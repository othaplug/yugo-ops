import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/check-role";

/**
 * POST /api/admin/partners/[partnerId]/rate-card/detach
 *
 * Detaches a partner from their template by:
 * 1. Copying all template rates as explicit partner_rate_overrides
 * 2. Clearing the template_id on the organization
 *
 * After this, the partner has a fully custom rate card not linked to any template.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireSuperAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;

  // Get partner
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .select("id, template_id, pricing_tier, global_discount_pct")
    .eq("id", partnerId)
    .single();

  if (orgErr || !org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  if (!org.template_id) return NextResponse.json({ error: "Partner is not linked to a template" }, { status: 400 });

  const templateId = org.template_id;
  const pricingTier = org.pricing_tier || "partner";
  const discount = org.global_discount_pct || 0;

  // Fetch all template rates
  const [dayRatesRes, deliveryRes, servicesRes, overagesRes, zonesRes] = await Promise.all([
    db.from("rate_card_day_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
    db.from("rate_card_delivery_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
    db.from("rate_card_services").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
    db.from("rate_card_overages").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
    db.from("rate_card_zones").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier),
  ]);

  function applyDiscount(val: number): number {
    return discount > 0 ? Math.round(val * (1 - discount / 100)) : val;
  }

  const overrides: any[] = [];

  for (const r of dayRatesRes.data || []) {
    overrides.push({ partner_id: partnerId, rate_table: "day_rates", rate_record_id: r.id, override_field: "full_day_price", override_value: applyDiscount(r.full_day_price), is_locked: true });
    overrides.push({ partner_id: partnerId, rate_table: "day_rates", rate_record_id: r.id, override_field: "half_day_price", override_value: applyDiscount(r.half_day_price), is_locked: true });
  }
  for (const r of deliveryRes.data || []) {
    overrides.push({ partner_id: partnerId, rate_table: "delivery_rates", rate_record_id: r.id, override_field: "price_min", override_value: applyDiscount(r.price_min), is_locked: true });
    if (r.price_max != null) overrides.push({ partner_id: partnerId, rate_table: "delivery_rates", rate_record_id: r.id, override_field: "price_max", override_value: applyDiscount(r.price_max), is_locked: true });
  }
  for (const r of servicesRes.data || []) {
    if (r.price_min > 0) overrides.push({ partner_id: partnerId, rate_table: "services", rate_record_id: r.id, override_field: "price_min", override_value: applyDiscount(r.price_min), is_locked: true });
  }
  for (const r of overagesRes.data || []) {
    overrides.push({ partner_id: partnerId, rate_table: "overages", rate_record_id: r.id, override_field: "price_per_stop", override_value: applyDiscount(r.price_per_stop), is_locked: true });
  }
  for (const r of zonesRes.data || []) {
    if (r.surcharge > 0) overrides.push({ partner_id: partnerId, rate_table: "zones", rate_record_id: r.id, override_field: "surcharge", override_value: applyDiscount(r.surcharge), is_locked: true });
  }

  // Upsert all overrides
  if (overrides.length > 0) {
    const { error: upsertErr } = await db
      .from("partner_rate_overrides")
      .upsert(overrides, { onConflict: "partner_id,rate_table,rate_record_id,override_field" });
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Clear template_id and global_discount_pct
  const { error: updateErr } = await db
    .from("organizations")
    .update({ template_id: null, global_discount_pct: 0 })
    .eq("id", partnerId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, overrides_created: overrides.length });
}
