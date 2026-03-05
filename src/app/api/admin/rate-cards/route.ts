import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const db = createAdminClient();
  const orgId = new URL(req.url).searchParams.get("organization_id");

  let query = db.from("partner_rate_cards").select(`
    id, organization_id, card_name, effective_date, expiry_date, is_active, created_at,
    organizations!inner(name, type, pricing_tier)
  `).eq("is_active", true).order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rateCards: data || [] });
}

export async function POST(req: NextRequest) {
  const { error: authErr, user } = await requireRole("manager");
  if (authErr) return authErr;

  const db = createAdminClient();
  const body = await req.json();
  const { organization_id, card_name, effective_date, template_card_id } = body;

  if (!organization_id) return NextResponse.json({ error: "organization_id required" }, { status: 400 });

  // Deactivate existing active cards for this org
  await db
    .from("partner_rate_cards")
    .update({ is_active: false })
    .eq("organization_id", organization_id)
    .eq("is_active", true);

  // Create new card
  const { data: card, error } = await db
    .from("partner_rate_cards")
    .insert({
      organization_id,
      card_name: card_name || "Rate Card",
      effective_date: effective_date || new Date().toISOString().split("T")[0],
      is_active: true,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If template provided, copy rates from template
  if (template_card_id && card) {
    await copyRateCardData(db, template_card_id, card.id);
  }

  return NextResponse.json({ ok: true, rateCard: card });
}

async function copyRateCardData(db: ReturnType<typeof createAdminClient>, fromId: string, toId: string) {
  const tables = [
    { table: "rate_card_day_rates", cols: "rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier" },
    { table: "rate_card_overages", cols: "rate_card_id, overage_tier, price_per_stop, pricing_tier" },
    { table: "rate_card_delivery_rates", cols: "rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier" },
    { table: "rate_card_zones", cols: "rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier" },
    { table: "rate_card_services", cols: "rate_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier" },
    { table: "rate_card_volume_bonuses", cols: "rate_card_id, min_deliveries, max_deliveries, discount_pct" },
  ];

  for (const { table } of tables) {
    const { data: rows } = await db.from(table).select("*").eq("rate_card_id", fromId);
    if (rows && rows.length > 0) {
      const mapped = rows.map((r) => {
        const copy = { ...r, rate_card_id: toId };
        delete copy.id;
        delete copy.created_at;
        return copy;
      });
      await db.from(table).insert(mapped);
    }
  }
}
