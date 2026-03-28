import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** Dashboard summary for property-management delivery partners. */
export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startStr = startOfMonth.toISOString().slice(0, 10);

  const [{ data: org }, { data: contract }, { data: properties }, { data: movesMonth }, { data: upcoming }] = await Promise.all([
    admin.from("organizations").select("id, name, type, vertical").eq("id", orgId).single(),
    admin
      .from("partner_contracts")
      .select("id, contract_number, contract_type, start_date, end_date, status, rate_card, tenant_comms_by")
      .eq("partner_id", orgId)
      .in("status", ["active", "negotiating", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("partner_properties").select("id, building_name, address, total_units, active").eq("partner_id", orgId).eq("active", true),
    admin
      .from("moves")
      .select("id, status, amount, estimate, scheduled_date, unit_number, tenant_name, partner_property_id, contract_id")
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .gte("scheduled_date", startStr),
    admin
      .from("moves")
      .select(
        "id, move_code, status, scheduled_date, scheduled_time, unit_number, tenant_name, partner_property_id, contract_id, from_address, to_address"
      )
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .gte("scheduled_date", new Date().toISOString().slice(0, 10))
      .order("scheduled_date", { ascending: true })
      .limit(25),
  ]);

  const props = properties ?? [];
  const totalUnits = props.reduce((s, p) => s + (Number(p.total_units) || 0), 0);
  const monthRows = movesMonth ?? [];
  const completed = monthRows.filter((m) => ["completed", "paid", "delivered"].includes(String(m.status || "").toLowerCase())).length;
  const revenue = monthRows.reduce((s, m) => s + (Number(m.amount ?? m.estimate) || 0), 0);

  const propById = new Map(props.map((p) => [p.id, p]));

  return NextResponse.json({
    org: org ?? { id: orgId, name: "", type: "", vertical: null },
    contract: contract ?? null,
    properties: props,
    stats: {
      propertiesCount: props.length,
      totalUnits,
      movesThisMonth: monthRows.length,
      movesCompletedThisMonth: completed,
      revenueThisMonth: revenue,
    },
    upcomingMoves: (upcoming ?? []).map((m) => ({
      ...m,
      building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
    })),
  });
}
