import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();

  const { data: templates, error } = await db
    .from("rate_card_templates")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count partners using each template
  const { data: orgs } = await db
    .from("organizations")
    .select("template_id")
    .not("template_id", "is", null);

  const countMap: Record<string, number> = {};
  for (const o of orgs || []) {
    if (o.template_id) countMap[o.template_id] = (countMap[o.template_id] || 0) + 1;
  }

  const enriched = (templates || []).map((t) => ({
    ...t,
    partner_count: countMap[t.id] || 0,
  }));

  return NextResponse.json({ templates: enriched });
}

export async function POST(req: NextRequest) {
  const { error: authErr, user } = await requireRole("owner");
  if (authErr) return authErr;

  const db = createAdminClient();
  const body = await req.json();
  const { template_name, template_slug, description, verticals_covered, copy_from_id } = body;

  if (!template_name || !template_slug) {
    return NextResponse.json({ error: "template_name and template_slug required" }, { status: 400 });
  }

  const { data: tmpl, error } = await db
    .from("rate_card_templates")
    .insert({ template_name, template_slug, description, verticals_covered, is_active: true })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Copy rates from another template if requested
  if (copy_from_id && tmpl) {
    await copyTemplateRates(db, copy_from_id, tmpl.id);
  }

  return NextResponse.json({ ok: true, template: tmpl });
}

async function copyTemplateRates(db: ReturnType<typeof createAdminClient>, fromId: string, toId: string) {
  const tables = [
    { table: "rate_card_day_rates", cols: ["vehicle_type","full_day_price","half_day_price","stops_included_full","stops_included_half","pricing_tier"] },
    { table: "rate_card_overages", cols: ["overage_tier","price_per_stop","pricing_tier"] },
    { table: "rate_card_delivery_rates", cols: ["delivery_type","zone","price_min","price_max","pricing_tier"] },
    { table: "rate_card_zones", cols: ["zone_number","zone_name","distance_min_km","distance_max_km","coverage_areas","surcharge","pricing_tier"] },
    { table: "rate_card_services", cols: ["service_slug","service_name","price_min","price_max","price_unit","pricing_tier"] },
    { table: "rate_card_volume_bonuses", cols: ["min_deliveries","max_deliveries","discount_pct"] },
  ];

  for (const { table, cols } of tables) {
    const { data: rows } = await (db as any).from(table).select("*").eq("template_id", fromId);
    if (rows && rows.length > 0) {
      const mapped = rows.map((r: any) => {
        const copy: Record<string, any> = { template_id: toId };
        for (const c of cols) copy[c] = r[c];
        return copy;
      });
      await (db as any).from(table).insert(mapped);
    }
  }
}
