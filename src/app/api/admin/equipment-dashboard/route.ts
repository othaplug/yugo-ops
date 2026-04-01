import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { formatFleetVehicleLabel } from "@/lib/fleet-vehicle-label";

export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: trucks }, { data: teRows }, { data: incidents }, { count: checks30d }] = await Promise.all([
    admin
      .from("fleet_vehicles")
      .select("id, display_name, license_plate, status")
      .in("status", ["active", "maintenance"])
      .order("display_name"),
    admin
      .from("truck_equipment")
      .select(
        "truck_id, assigned_quantity, current_quantity, last_checked, equipment_inventory(name)",
      ),
    admin
      .from("equipment_incidents")
      .select(
        "id, created_at, shortage, replacement_cost, reason, equipment_id, move_id, delivery_id, equipment_inventory(name)",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("equipment_checks")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  type TeRow = {
    truck_id: string;
    assigned_quantity: number;
    current_quantity: number;
    last_checked: string | null;
    equipment_inventory: { name: string } | null | { name: string }[];
  };

  function equipName(row: TeRow): string | null {
    const ei = row.equipment_inventory;
    if (!ei) return null;
    const one = Array.isArray(ei) ? ei[0] : ei;
    return one?.name ?? null;
  }

  const byTruck = new Map<
    string,
    { short: number; total: number; ok: number; last: string | null }
  >();

  for (const r of (teRows || []) as TeRow[]) {
    const tid = r.truck_id;
    const cur = byTruck.get(tid) || { short: 0, total: 0, ok: 0, last: null };
    cur.total += 1;
    const assigned = Number(r.assigned_quantity) || 0;
    const current = Number(r.current_quantity) || 0;
    if (current < assigned) cur.short += 1;
    else cur.ok += 1;
    if (r.last_checked && (!cur.last || r.last_checked > cur.last)) cur.last = r.last_checked;
    byTruck.set(tid, cur);
  }

  const fleetOverview = (trucks || []).map((t) => {
    const s = byTruck.get(t.id) || { short: 0, total: 0, ok: 0, last: null };
    return {
      truckId: t.id,
      name: formatFleetVehicleLabel({
        display_name: t.display_name as string,
        license_plate: t.license_plate as string,
      }),
      status: s.short > 0 ? "low" : "full",
      itemsLabel: s.total ? `${s.ok}/${s.total}` : "—",
      shortCount: s.short,
      lastChecked: s.last,
    };
  });

  const restockMap = new Map<string, { short: number; cost: number }>();
  for (const r of (teRows || []) as TeRow[]) {
    const assigned = Number(r.assigned_quantity) || 0;
    const current = Number(r.current_quantity) || 0;
    if (current >= assigned) continue;
    const name = equipName(r) || "Item";
    const prev = restockMap.get(name) || { short: 0, cost: 0 };
    prev.short += assigned - current;
    restockMap.set(name, prev);
  }

  const itemsNeedingRestock = [...restockMap.entries()]
    .map(([name, v]) => ({ name, shortAcross: v.short, estCost: v.cost }))
    .sort((a, b) => b.shortAcross - a.shortAcross)
    .slice(0, 12);

  type IncRow = {
    id: string;
    created_at: string;
    shortage: number;
    replacement_cost: number | null;
    reason: string;
    move_id: string | null;
    delivery_id: string | null;
    equipment_inventory: { name: string } | null | { name: string }[];
  };

  function incidentItemName(i: IncRow): string {
    const ei = i.equipment_inventory;
    if (!ei) return "Item";
    const one = Array.isArray(ei) ? ei[0] : ei;
    return one?.name || "Item";
  }

  let lossTotal = 0;
  const lossHistory = ((incidents || []) as IncRow[]).map((i) => {
    const cost = i.replacement_cost != null ? Number(i.replacement_cost) : 0;
    lossTotal += cost;
    return {
      id: i.id,
      date: i.created_at,
      moveId: i.move_id,
      deliveryId: i.delivery_id,
      item: incidentItemName(i),
      qty: i.shortage,
      reason: i.reason,
      cost,
    };
  });

  const nChecks = checks30d ?? 0;
  const avgEquipmentCostPerJob30d =
    nChecks > 0 ? Math.round((lossTotal / nChecks) * 100) / 100 : 0;

  return NextResponse.json({
    fleetOverview,
    itemsNeedingRestock,
    lossHistory,
    lossTotal30d: Math.round(lossTotal * 100) / 100,
    equipmentChecksSubmitted30d: nChecks,
    avgEquipmentCostPerJob30d,
  });
}
