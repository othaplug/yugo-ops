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
  const todayStr = new Date().toISOString().slice(0, 10);

  const [
    { data: org },
    { data: contract },
    { data: properties },
    { data: movesMonth },
    { data: upcoming },
    { data: recentCompleted },
    { data: projects },
    { data: globals },
    { data: customs },
  ] = await Promise.all([
    admin.from("organizations").select("id, name, type, vertical").eq("id", orgId).single(),
    admin
      .from("partner_contracts")
      .select("id, contract_number, contract_type, start_date, end_date, status, rate_card, tenant_comms_by")
      .eq("partner_id", orgId)
      .in("status", ["active", "negotiating", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("partner_properties")
      .select("id, building_name, address, total_units, active, service_region")
      .eq("partner_id", orgId)
      .eq("active", true),
    admin
      .from("moves")
      .select("id, status, amount, estimate, scheduled_date, unit_number, tenant_name, partner_property_id, contract_id")
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .gte("scheduled_date", startStr),
    admin
      .from("moves")
      .select(
        "id, move_code, status, scheduled_date, scheduled_time, unit_number, tenant_name, partner_property_id, contract_id, from_address, to_address, pm_reason_code, pm_move_kind"
      )
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .gte("scheduled_date", todayStr)
      .order("scheduled_date", { ascending: true })
      .limit(25),
    admin
      .from("moves")
      .select(
        "id, move_code, status, scheduled_date, unit_number, tenant_name, partner_property_id, pm_reason_code, pm_move_kind, amount, estimate"
      )
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .in("status", ["completed", "paid", "delivered"])
      .order("scheduled_date", { ascending: false })
      .limit(10),
    admin
      .from("pm_projects")
      .select("id, project_name, project_type, total_units, start_date, end_date, status")
      .eq("partner_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),
    admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null),
    admin.from("pm_move_reasons").select("reason_code, label").eq("partner_id", orgId).eq("active", true),
  ]);

  const props = properties ?? [];
  const totalUnits = props.reduce((s, p) => s + (Number(p.total_units) || 0), 0);
  const monthRows = movesMonth ?? [];
  const completed = monthRows.filter((m) => ["completed", "paid", "delivered"].includes(String(m.status || "").toLowerCase())).length;
  const revenue = monthRows.reduce((s, m) => s + (Number(m.amount ?? m.estimate) || 0), 0);

  const propById = new Map(props.map((p) => [p.id, p]));

  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  const upcomingList = upcoming ?? [];
  const scheduledByProperty: Record<string, number> = {};
  for (const m of upcomingList) {
    const pid = m.partner_property_id as string | null;
    if (pid) scheduledByProperty[pid] = (scheduledByProperty[pid] ?? 0) + 1;
  }

  const showPropertyStrip = props.length >= 2;
  const showProjects = (projects ?? []).length > 0;

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
    upcomingMoves: upcomingList.map((m) => ({
      ...m,
      building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
      move_type_label:
        reasonLabels[(m.pm_reason_code as string) || ""] ||
        reasonLabels[(m.pm_move_kind as string) || ""] ||
        null,
    })),
    recentCompleted: (recentCompleted ?? []).map((m) => ({
      ...m,
      building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
      move_type_label:
        reasonLabels[(m.pm_reason_code as string) || ""] ||
        reasonLabels[(m.pm_move_kind as string) || ""] ||
        null,
    })),
    projects: projects ?? [],
    dashboard: {
      showPropertyStrip,
      showProjects,
      scheduledByProperty,
    },
    reasonLabels,
  });
}
