import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { logAudit } from "@/lib/audit";

const TABLE_MAP: Record<string, string> = {
  "base-rates": "base_rates",
  config: "platform_config",
  neighbourhoods: "neighbourhood_tiers",
  "access-scores": "access_scores",
  "date-factors": "date_factors",
  surcharges: "specialty_surcharges",
  "single-item": "single_item_rates",
  "deposit-rules": "deposit_rules",
  "office-rates": "office_rates",
  "item-weights": "item_weights",
  "volume-benchmarks": "volume_benchmarks",
  "fleet-vehicles": "fleet_vehicles",
  "truck-rules": "truck_allocation_rules",
  "valuation-tiers": "valuation_tiers",
  "valuation-upgrades": "valuation_upgrades",
};

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const section = req.nextUrl.searchParams.get("section");
  if (!section || !TABLE_MAP[section]) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const table = TABLE_MAP[section];
    const { data, error } = await supabase.from(table).select("*").order("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { user, role, error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { section, rows } = await req.json();
    if (!section || !TABLE_MAP[section] || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const table = TABLE_MAP[section];

    for (const row of rows) {
      if (row.id) {
        const { id, ...rest } = row;
        await supabase.from(table).update(rest).eq("id", id);
      }
    }

    logAudit({
      userId: user?.id,
      userEmail: user?.email,
      userRole: role,
      action: "edit_pricing",
      resourceType: "pricing",
      resourceId: section,
      details: { table: section },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { section, row } = await req.json();
    if (!section || !TABLE_MAP[section] || !row) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const table = TABLE_MAP[section];
    const { id: _id, ...insertData } = row;
    const { data, error } = await supabase.from(table).insert(insertData).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { section, id } = await req.json();
    if (!section || !TABLE_MAP[section] || !id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from(TABLE_MAP[section]).delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
