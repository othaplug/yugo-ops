import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { id } = await params;

  const [tmplRes, dayRatesRes, deliveryRes, servicesRes, overagesRes, zonesRes, volumeRes] = await Promise.all([
    db.from("rate_card_templates").select("*").eq("id", id).single(),
    db.from("rate_card_day_rates").select("*").eq("template_id", id).order("pricing_tier").order("vehicle_type"),
    db.from("rate_card_delivery_rates").select("*").eq("template_id", id).order("pricing_tier").order("delivery_type").order("zone"),
    db.from("rate_card_services").select("*").eq("template_id", id).order("pricing_tier").order("service_slug"),
    db.from("rate_card_overages").select("*").eq("template_id", id).order("pricing_tier").order("overage_tier"),
    db.from("rate_card_zones").select("*").eq("template_id", id).order("pricing_tier").order("zone_number"),
    db.from("rate_card_volume_bonuses").select("*").eq("template_id", id).order("min_deliveries"),
  ]);

  if (tmplRes.error || !tmplRes.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Count partners
  const { data: partnerOrgs } = await db
    .from("organizations")
    .select("id, name, type, pricing_tier")
    .eq("template_id", id);

  return NextResponse.json({
    template: tmplRes.data,
    dayRates: dayRatesRes.data || [],
    deliveryRates: deliveryRes.data || [],
    services: servicesRes.data || [],
    overages: overagesRes.data || [],
    zones: zonesRes.data || [],
    volumeBonuses: volumeRes.data || [],
    partners: partnerOrgs || [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("owner");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { id } = await params;
  const body = await req.json();
  const { template_name, description, verticals_covered, is_active, rates } = body;

  // Update template meta
  if (template_name !== undefined || description !== undefined || verticals_covered !== undefined || is_active !== undefined) {
    const { error } = await db
      .from("rate_card_templates")
      .update({ template_name, description, verticals_covered, is_active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update individual rate rows (upsert by id)
  if (rates) {
    const rateTables = ["day_rates", "delivery_rates", "services", "overages", "zones", "volume_bonuses"] as const;
    const tableMap: Record<string, string> = {
      day_rates: "rate_card_day_rates",
      delivery_rates: "rate_card_delivery_rates",
      services: "rate_card_services",
      overages: "rate_card_overages",
      zones: "rate_card_zones",
      volume_bonuses: "rate_card_volume_bonuses",
    };

    for (const key of rateTables) {
      const rows: any[] = rates[key] || [];
      if (rows.length === 0) continue;
      const tableName = tableMap[key];
      for (const row of rows) {
        const { id: rowId, ...fields } = row;
        if (rowId) {
          await (db as any).from(tableName).update(fields).eq("id", rowId);
        } else {
          await (db as any).from(tableName).insert({ ...fields, template_id: id });
        }
      }
    }
  }

  // Count affected partners
  const { data: affectedOrgs } = await db
    .from("organizations")
    .select("id")
    .eq("template_id", id);

  const affectedCount = affectedOrgs?.length || 0;

  // Count locked overrides (partners won't be affected)
  const { count: lockedCount } = await db
    .from("partner_rate_overrides")
    .select("*", { count: "exact", head: true })
    .eq("is_locked", true)
    .in("partner_id", (affectedOrgs || []).map((o) => o.id));

  return NextResponse.json({
    ok: true,
    affected_partners: affectedCount,
    locked_overrides: lockedCount || 0,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("owner");
  if (authErr) return authErr;

  const db = createAdminClient();
  const { id } = await params;

  // Check if partners are using this template
  const { data: usingOrgs } = await db
    .from("organizations")
    .select("id")
    .eq("template_id", id);

  if (usingOrgs && usingOrgs.length > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${usingOrgs.length} partner(s) still using this template` },
      { status: 409 }
    );
  }

  const { error } = await db.from("rate_card_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
