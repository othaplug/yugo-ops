import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { partnerMoveTrackingUrl } from "@/lib/partner/pm-track-url";

function propertyAccessIncomplete(p: {
  move_hours?: string | null;
  building_contact_name?: string | null;
  building_contact_phone?: string | null;
}) {
  const hours = String(p.move_hours || "").trim();
  const name = String(p.building_contact_name || "").trim();
  const phone = String(p.building_contact_phone || "").trim();
  return !hours || !name || !phone;
}

function invoiceCountsAsOverdue(
  inv: { status: string | null | undefined; due_date: string | null | undefined },
  todayYmd: string,
) {
  const st = String(inv.status || "").toLowerCase();
  if (st === "overdue") return true;
  if (st !== "sent" && st !== "partial") return false;
  const d = inv.due_date ? String(inv.due_date).slice(0, 10) : "";
  return Boolean(d && d < todayYmd);
}

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
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const [
    { data: org },
    { data: contract },
    { data: properties },
    { data: movesMonth },
    { data: upcoming },
    { data: recentCompleted },
    { data: projects },
    { data: pendingApprovalMoves },
    { data: partnerInvoices },
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
      .select(
        "id, building_name, address, total_units, active, service_region, move_hours, building_contact_name, building_contact_phone",
      )
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
      .limit(60),
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
      .select("id, project_name, project_type, total_units, start_date, end_date, status, property_id")
      .eq("partner_id", orgId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("moves")
      .select("id")
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .eq("status", "pending_approval"),
    admin
      .from("invoices")
      .select("id, status, due_date")
      .eq("organization_id", orgId)
      .in("status", ["sent", "overdue", "partial"]),
    admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null),
    admin.from("pm_move_reasons").select("reason_code, label").eq("partner_id", orgId).eq("active", true),
  ]);

  const propsRaw = properties ?? [];
  const buildingsIncompleteAccessCount = propsRaw.filter(propertyAccessIncomplete).length;
  const props = propsRaw.map((p) => ({
    id: p.id as string,
    building_name: p.building_name as string,
    address: p.address as string,
    total_units: p.total_units as number | null,
    active: p.active as boolean,
    service_region: (p.service_region as string | null) ?? null,
  }));
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

  const terminal = new Set(["completed", "paid", "delivered", "cancelled"]);
  const todaysMoves = upcomingList.filter(
    (m) => String(m.scheduled_date || "") === todayStr && !terminal.has(String(m.status || "").toLowerCase()),
  );

  const weekMovesByDate: Record<
    string,
    {
      id: string;
      move_code: string | null;
      unit_number: string | null;
      tenant_name: string | null;
      building_name: string | null;
      scheduled_time: string | null;
      status: string | null;
    }[]
  > = {};
  for (const m of upcomingList) {
    const d = String(m.scheduled_date || "");
    if (!d || d < todayStr || d > weekEndStr) continue;
    if (terminal.has(String(m.status || "").toLowerCase())) continue;
    if (!weekMovesByDate[d]) weekMovesByDate[d] = [];
    if (weekMovesByDate[d].length < 6) {
      weekMovesByDate[d].push({
        id: m.id as string,
        move_code: m.move_code as string | null,
        unit_number: m.unit_number as string | null,
        tenant_name: m.tenant_name as string | null,
        building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
        scheduled_time: m.scheduled_time as string | null,
        status: m.status as string | null,
      });
    }
  }

  const activeProjectsCount = (projects ?? []).length;
  const upcomingScheduledCount = upcomingList.filter(
    (m) => !terminal.has(String(m.status || "").toLowerCase()),
  ).length;

  const showPropertyStrip = props.length >= 2;
  const showProjects = (projects ?? []).length > 0;

  const pendingApprovalMoveCount = (pendingApprovalMoves ?? []).length;
  const overdueInvoiceCount = (partnerInvoices ?? []).filter((i) =>
    invoiceCountsAsOverdue(
      { status: String(i.status ?? ""), due_date: (i.due_date as string | null) ?? null },
      todayStr,
    ),
  ).length;

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
      upcomingScheduledCount,
    },
    upcomingMoves: upcomingList.map((m) => {
      const st = String(m.status || "").toLowerCase();
      const open = !terminal.has(st);
      return {
        ...m,
        building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
        move_type_label:
          reasonLabels[(m.pm_reason_code as string) || ""] ||
          reasonLabels[(m.pm_move_kind as string) || ""] ||
          null,
        tracking_url:
          open && m.id
            ? partnerMoveTrackingUrl({ id: m.id as string, move_code: m.move_code as string | null })
            : null,
      };
    }),
    todaysMoves: todaysMoves.map((m) => ({
      id: m.id as string,
      move_code: m.move_code as string | null,
      scheduled_date: m.scheduled_date as string | null,
      scheduled_time: m.scheduled_time as string | null,
      unit_number: m.unit_number as string | null,
      tenant_name: m.tenant_name as string | null,
      status: m.status as string | null,
      building_name: m.partner_property_id ? propById.get(m.partner_property_id)?.building_name ?? null : null,
      move_type_label:
        reasonLabels[(m.pm_reason_code as string) || ""] ||
        reasonLabels[(m.pm_move_kind as string) || ""] ||
        null,
      tracking_url: partnerMoveTrackingUrl({ id: m.id as string, move_code: m.move_code as string | null }),
    })),
    weekMovesByDate,
    activeProjectsCount,
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
    overviewAttention: {
      pendingApprovalMoveCount,
      overdueInvoiceCount,
      buildingsIncompleteAccessCount,
    },
    reasonLabels,
  });
}
