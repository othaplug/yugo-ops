import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;

  // Get partner org with template info
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .select("id, name, type, pricing_tier, template_id, global_discount_pct, rates_locked")
    .eq("id", partnerId)
    .single();

  if (orgErr || !org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  // Get all available templates for the dropdown
  const { data: allTemplates } = await db
    .from("rate_card_templates")
    .select("id, template_name, template_slug, is_active, verticals_covered")
    .eq("is_active", true)
    .order("template_name");

  // If no template assigned, return early
  if (!org.template_id) {
    return NextResponse.json({
      partner: org,
      template: null,
      templates: allTemplates || [],
      dayRates: [], deliveryRates: [], services: [],
      overages: [], zones: [], volumeBonuses: [],
      overrides: [],
      mode: "no_template",
    });
  }

  const templateId = org.template_id;
  const pricingTier = org.pricing_tier || "partner";

  // Get template info + rates + overrides in parallel
  const [tmplRes, dayRatesRes, deliveryRes, servicesRes, overagesRes, zonesRes, volumeRes, overridesRes] =
    await Promise.all([
      db.from("rate_card_templates").select("*").eq("id", templateId).single(),
      db.from("rate_card_day_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier).order("vehicle_type"),
      db.from("rate_card_delivery_rates").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier).order("delivery_type").order("zone"),
      db.from("rate_card_services").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier).order("service_slug"),
      db.from("rate_card_overages").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier).order("overage_tier"),
      db.from("rate_card_zones").select("*").eq("template_id", templateId).eq("pricing_tier", pricingTier).order("zone_number"),
      db.from("rate_card_volume_bonuses").select("*").eq("template_id", templateId).order("min_deliveries"),
      db.from("partner_rate_overrides").select("*").eq("partner_id", partnerId),
    ]);

  return NextResponse.json({
    partner: org,
    template: tmplRes.data || null,
    templates: allTemplates || [],
    dayRates: dayRatesRes.data || [],
    deliveryRates: deliveryRes.data || [],
    services: servicesRes.data || [],
    overages: overagesRes.data || [],
    zones: zonesRes.data || [],
    volumeBonuses: volumeRes.data || [],
    overrides: overridesRes.data || [],
    mode: "template",
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireRole("admin");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;
  const body = await req.json();
  const { template_id, global_discount_pct, pricing_tier, rates_locked } = body;

  const updates: Record<string, any> = {};
  if (template_id !== undefined) updates.template_id = template_id;
  if (global_discount_pct !== undefined) updates.global_discount_pct = global_discount_pct;
  if (pricing_tier !== undefined) updates.pricing_tier = pricing_tier;
  if (rates_locked !== undefined) updates.rates_locked = rates_locked;

  const { error } = await db.from("organizations").update(updates).eq("id", partnerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
