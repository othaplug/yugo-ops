import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();

  const [card, dayRates, overages, deliveryRates, zones, services, volumeBonuses] = await Promise.all([
    db.from("partner_rate_cards").select("*, organizations(name, type, pricing_tier)").eq("id", id).single(),
    db.from("rate_card_day_rates").select("*").eq("rate_card_id", id).order("pricing_tier").order("vehicle_type"),
    db.from("rate_card_overages").select("*").eq("rate_card_id", id).order("pricing_tier").order("overage_tier"),
    db.from("rate_card_delivery_rates").select("*").eq("rate_card_id", id).order("pricing_tier").order("zone").order("delivery_type"),
    db.from("rate_card_zones").select("*").eq("rate_card_id", id).order("pricing_tier").order("zone_number"),
    db.from("rate_card_services").select("*").eq("rate_card_id", id).order("pricing_tier").order("service_slug"),
    db.from("rate_card_volume_bonuses").select("*").eq("rate_card_id", id).order("min_deliveries"),
  ]);

  if (card.error) return NextResponse.json({ error: card.error.message }, { status: 404 });

  return NextResponse.json({
    rateCard: card.data,
    dayRates: dayRates.data || [],
    overages: overages.data || [],
    deliveryRates: deliveryRates.data || [],
    zones: zones.data || [],
    services: services.data || [],
    volumeBonuses: volumeBonuses.data || [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();
  const body = await req.json();

  const { section, data } = body;

  if (!section || !data) {
    return NextResponse.json({ error: "section and data required" }, { status: 400 });
  }

  const TABLE_MAP: Record<string, string> = {
    day_rates: "rate_card_day_rates",
    overages: "rate_card_overages",
    delivery_rates: "rate_card_delivery_rates",
    zones: "rate_card_zones",
    services: "rate_card_services",
    volume_bonuses: "rate_card_volume_bonuses",
  };

  const table = TABLE_MAP[section];
  if (!table) return NextResponse.json({ error: "Invalid section" }, { status: 400 });

  if (body.action === "upsert") {
    for (const row of Array.isArray(data) ? data : [data]) {
      if (row.id) {
        const { id: rowId, created_at, ...rest } = row;
        await db.from(table).update(rest).eq("id", rowId);
      } else {
        await db.from(table).insert({ ...row, rate_card_id: id });
      }
    }
  } else if (body.action === "delete") {
    const ids = Array.isArray(data) ? data : [data];
    await db.from(table).delete().in("id", ids);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireRole("admin");
  if (authErr) return authErr;

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db.from("partner_rate_cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
