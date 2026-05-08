import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

/** Full building list with move stats and recent moves for PM portal. */
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

  const { data: properties } = await admin
    .from("partner_properties")
    .select(
      "id, building_name, address, total_units, unit_types, has_loading_dock, has_move_elevator, elevator_type, move_hours, parking_type, building_contact_name, building_contact_phone, notes, service_region",
    )
    .eq("partner_id", orgId)
    .eq("active", true)
    .order("building_name", { ascending: true });

  const props = properties ?? [];
  const propIds = props.map((p) => p.id as string);
  if (propIds.length === 0) {
    return NextResponse.json({ buildings: [] });
  }

  const { data: allMoves } = await admin
    .from("moves")
    .select(
      "id, move_code, status, scheduled_date, scheduled_time, unit_number, tenant_name, partner_property_id, pm_reason_code, pm_move_kind, final_amount, total_price, amount, estimate",
    )
    .eq("organization_id", orgId)
    .not("contract_id", "is", null)
    .in("partner_property_id", propIds);

  const moves = allMoves ?? [];

  const { data: globals } = await admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);
  const { data: customs } = await admin.from("pm_move_reasons").select("reason_code, label").eq("partner_id", orgId).eq("active", true);
  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  const terminal = new Set(["completed", "paid", "delivered"]);

  const buildings = props.map((p) => {
    const pid = p.id as string;
    const forProp = moves.filter((m) => m.partner_property_id === pid);
    const monthMoves = forProp.filter((m) => String(m.scheduled_date || "") >= startStr);
    const upcoming = forProp.filter(
      (m) => String(m.scheduled_date || "") >= todayStr && !terminal.has(String(m.status || "").toLowerCase()),
    );
    const totalMoves = forProp.length;
    const recent = [...forProp]
      .filter((m) => terminal.has(String(m.status || "").toLowerCase()))
      .sort((a, b) => String(b.scheduled_date).localeCompare(String(a.scheduled_date)))
      .slice(0, 8)
      .map((m) => ({
        id: m.id,
        date: m.scheduled_date,
        unit: m.unit_number,
        move_type:
          reasonLabels[(m.pm_reason_code as string) || ""] ||
          reasonLabels[(m.pm_move_kind as string) || ""] ||
          "Move",
        tenant_name: m.tenant_name,
        status: m.status,
        price: Number(m.final_amount ?? m.total_price ?? m.amount ?? m.estimate) || 0,
      }));

    const unitTypes = (p.unit_types as string[] | null) ?? [];
    const unitCounts: Record<string, string> = {};
    for (const t of unitTypes) unitCounts[t] = "—";

    return {
      id: pid,
      name: p.building_name,
      address: p.address,
      total_units: p.total_units,
      loading_dock: !!p.has_loading_dock,
      elevator: p.has_move_elevator ? (p.elevator_type as string | null) || "Yes" : "No",
      move_hours: p.move_hours,
      parking: (p.parking_type as string | null) || "—",
      contact_name: p.building_contact_name || "—",
      contact_phone: p.building_contact_phone || "—",
      notes: p.notes,
      unit_types: unitTypes.length ? unitTypes : ["Studio", "1 BR", "2 BR", "3 BR"],
      unit_counts: unitCounts,
      moves_this_month: monthMoves.length,
      upcoming_moves: upcoming.length,
      total_moves: totalMoves,
      recent_moves: recent,
    };
  });

  return NextResponse.json({ buildings });
}
