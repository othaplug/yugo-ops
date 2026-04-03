import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;

  // Get partner org with template info
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .select("id, name, type, vertical, pricing_tier, template_id, global_discount_pct, rates_locked")
    .eq("id", partnerId)
    .single();

  if (orgErr || !org) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const orgVertical = String((org as { vertical?: string; type?: string }).vertical || (org as { type?: string }).type || "");
  const portfolioPartner = isPropertyManagementDeliveryVertical(orgVertical);

  let pmContract: Record<string, unknown> | null = null;
  let pmRates: Record<string, unknown>[] = [];
  let pmAddons: Record<string, unknown>[] = [];

  if (portfolioPartner) {
    const { data: contracts } = await db
      .from("partner_contracts")
      .select("id, contract_number, contract_type, status, start_date, end_date")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false });

    const contractRow =
      (contracts || []).find((c) => (c as { status?: string }).status === "active") || (contracts || [])[0] || null;

    if (contractRow?.id) {
      pmContract = contractRow as Record<string, unknown>;
      const [ratesRes, addonsRes] = await Promise.all([
        db
          .from("pm_rate_cards")
          .select("*")
          .eq("contract_id", contractRow.id as string)
          .eq("active", true)
          .order("reason_code"),
        db.from("pm_contract_addons").select("*").eq("contract_id", contractRow.id as string).eq("active", true),
      ]);
      pmRates = (ratesRes.data || []) as Record<string, unknown>[];
      pmAddons = (addonsRes.data || []) as Record<string, unknown>[];
    }
  }

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
      portfolioPartner,
      pmContract,
      pmRates,
      pmAddons,
    });
  }

  const templateId = org.template_id;

  // Get template info + rates + overrides in parallel
  const [tmplRes, dayRatesRes, deliveryRes, servicesRes, overagesRes, zonesRes, volumeRes, overridesRes] =
    await Promise.all([
      db.from("rate_card_templates").select("*").eq("id", templateId).single(),
      db.from("rate_card_day_rates").select("*").eq("template_id", templateId).order("pricing_tier").order("vehicle_type"),
      db.from("rate_card_delivery_rates").select("*").eq("template_id", templateId).order("pricing_tier").order("delivery_type").order("zone"),
      db.from("rate_card_services").select("*").eq("template_id", templateId).order("pricing_tier").order("service_slug"),
      db.from("rate_card_overages").select("*").eq("template_id", templateId).order("pricing_tier").order("overage_tier"),
      db.from("rate_card_zones").select("*").eq("template_id", templateId).order("pricing_tier").order("zone_number"),
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
    portfolioPartner,
    pmContract,
    pmRates,
    pmAddons,
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
