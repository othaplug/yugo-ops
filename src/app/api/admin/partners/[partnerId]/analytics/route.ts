import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";

const MOVE_DONE = ["completed", "delivered", "paid"];

function moveRevenue(m: { amount?: unknown; estimate?: unknown }): number {
  const a = Number(m.amount);
  if (Number.isFinite(a) && a > 0) return a;
  const e = Number(m.estimate);
  return Number.isFinite(e) && e > 0 ? e : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { partnerId: orgId } = await params;
  const period = Number(req.nextUrl.searchParams.get("period") || 90);
  const sinceMs = Date.now() - period * 24 * 60 * 60 * 1000;
  const sinceDate = new Date(sinceMs).toISOString().split("T")[0];
  const sinceIso = new Date(sinceMs).toISOString();
  const admin = createAdminClient();

  const { data: orgRow } = await admin
    .from("organizations")
    .select("type, vertical")
    .eq("id", orgId)
    .maybeSingle();

  const orgType = String(orgRow?.vertical || orgRow?.type || "");
  const useMoves = isPropertyManagementDeliveryVertical(orgType);

  if (useMoves) {
    const moveSelect =
      "id, status, scheduled_date, completed_at, estimate, amount, pm_zone";

    const [{ data: bySchedule }, { data: byCompletion }] = await Promise.all([
      admin
        .from("moves")
        .select(moveSelect)
        .eq("organization_id", orgId)
        .in("status", MOVE_DONE)
        .gte("scheduled_date", sinceDate),
      admin
        .from("moves")
        .select(moveSelect)
        .eq("organization_id", orgId)
        .in("status", MOVE_DONE)
        .gte("completed_at", sinceIso),
    ]);

    const byId = new Map<string, NonNullable<typeof bySchedule>[number]>();
    for (const d of [...(bySchedule || []), ...(byCompletion || [])]) {
      byId.set(d.id, d);
    }
    const all = Array.from(byId.values());
    const total = all.length;
    const revenue = all.reduce((s, d) => s + moveRevenue(d), 0);
    const avgRevenuePerDelivery = total > 0 ? Math.round(revenue / total) : 0;

    let onTimeCount = 0;
    for (const m of all) {
      if (!m.completed_at || !m.scheduled_date) {
        onTimeCount++;
        continue;
      }
      const endOfSched = new Date(`${m.scheduled_date}T23:59:59`);
      const comp = new Date(m.completed_at);
      if (comp <= endOfSched) onTimeCount++;
    }
    const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

    const { data: yearData } = await admin
      .from("moves")
      .select("scheduled_date, estimate, amount, pm_zone")
      .eq("organization_id", orgId)
      .in("status", MOVE_DONE)
      .gte("scheduled_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

    const monthlyMap: Record<string, { count: number; revenue: number }> = {};
    const zoneMap: Record<string, number> = {};

    for (const d of yearData || []) {
      const m = (d.scheduled_date || "").slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { count: 0, revenue: 0 };
      monthlyMap[m].count++;
      monthlyMap[m].revenue += moveRevenue(d);
      const z = d.pm_zone?.trim() ? String(d.pm_zone) : "Unspecified";
      zoneMap[z] = (zoneMap[z] || 0) + 1;
    }

    const months = Object.keys(monthlyMap).sort();
    const monthlyVolume = months.map((m) => ({
      month: new Date(`${m}-15`).toLocaleDateString("en-US", { month: "short" }),
      count: monthlyMap[m].count,
      revenue: Math.round(monthlyMap[m].revenue),
    }));

    const totalZone = Object.values(zoneMap).reduce((s, v) => s + v, 0);
    const zoneDistribution = Object.entries(zoneMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([zone, count]) => ({
        zone,
        count,
        pct: totalZone > 0 ? Math.round((count / totalZone) * 100) : 0,
      }));

    return NextResponse.json({
      totalDeliveries: total,
      revenue,
      avgRevenuePerDelivery,
      onTimeRate,
      satisfactionScore: null,
      damageRate: 0,
      monthlyVolume,
      zoneDistribution,
      source: "moves",
    });
  }

  const deliverySelect =
    "id, status, scheduled_date, time_slot, delivery_window, completed_at, total_price, zone, booking_type";

  const [{ data: bySchedule }, { data: byCompletion }] = await Promise.all([
    admin
      .from("deliveries")
      .select(deliverySelect)
      .eq("organization_id", orgId)
      .in("status", ["delivered", "completed"])
      .gte("scheduled_date", sinceDate),
    admin
      .from("deliveries")
      .select(deliverySelect)
      .eq("organization_id", orgId)
      .in("status", ["delivered", "completed"])
      .gte("completed_at", sinceIso),
  ]);

  const byId = new Map<string, NonNullable<typeof bySchedule>[number]>();
  for (const d of [...(bySchedule || []), ...(byCompletion || [])]) {
    byId.set(d.id, d);
  }
  const all = Array.from(byId.values());
  const total = all.length;
  const revenue = all.reduce((s, d) => s + Number(d.total_price || 0), 0);
  const avgRevenuePerDelivery = total > 0 ? Math.round(revenue / total) : 0;

  let onTimeCount = 0;
  for (const d of all) {
    if (!d.completed_at) {
      onTimeCount++;
      continue;
    }
    const hour = new Date(d.completed_at).getHours();
    const w = d.delivery_window || d.time_slot || "";
    const ok = w.includes("morning") ? hour < 12 : w.includes("afternoon") ? hour < 17 : hour < 18;
    if (ok) onTimeCount++;
  }
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  const ids = all.map((d) => d.id);
  let satisfactionScore: number | null = null;
  if (ids.length > 0) {
    const { data: pods } = await admin
      .from("proof_of_delivery")
      .select("satisfaction_rating")
      .in("delivery_id", ids)
      .not("satisfaction_rating", "is", null);
    if (pods && pods.length > 0) {
      const ratings = pods
        .map((p) => Number(p.satisfaction_rating))
        .filter((r) => r >= 1 && r <= 5);
      if (ratings.length > 0) {
        const sum = ratings.reduce((s, r) => s + r, 0);
        satisfactionScore = Math.round((sum / ratings.length) * 10) / 10;
      }
    }
  }

  let damageCount = 0;
  if (ids.length > 0) {
    const { data: damagePods } = await admin
      .from("proof_of_delivery")
      .select("item_conditions")
      .in("delivery_id", ids);
    for (const p of damagePods || []) {
      const conds = Array.isArray(p.item_conditions) ? p.item_conditions : [];
      if (conds.some((ic: { condition: string }) => ic.condition === "new_damage")) damageCount++;
    }
  }
  const damageRate = total > 0 ? Math.round((damageCount / total) * 1000) / 10 : 0;

  const { data: yearData } = await admin
    .from("deliveries")
    .select("scheduled_date, total_price, zone")
    .eq("organization_id", orgId)
    .in("status", ["delivered", "completed"])
    .gte("scheduled_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  const monthlyMap: Record<string, { count: number; revenue: number }> = {};
  const zoneMap: Record<string, number> = {};

  for (const d of yearData || []) {
    const m = (d.scheduled_date || "").slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { count: 0, revenue: 0 };
    monthlyMap[m].count++;
    monthlyMap[m].revenue += Number(d.total_price || 0);
    const z = `Zone ${d.zone || 1}`;
    zoneMap[z] = (zoneMap[z] || 0) + 1;
  }

  const months = Object.keys(monthlyMap).sort();
  const monthlyVolume = months.map((m) => ({
    month: new Date(`${m}-15`).toLocaleDateString("en-US", { month: "short" }),
    count: monthlyMap[m].count,
    revenue: Math.round(monthlyMap[m].revenue),
  }));

  const totalZone = Object.values(zoneMap).reduce((s, v) => s + v, 0);
  const zoneDistribution = Object.entries(zoneMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, count]) => ({
      zone,
      count,
      pct: totalZone > 0 ? Math.round((count / totalZone) * 100) : 0,
    }));

  return NextResponse.json({
    totalDeliveries: total,
    revenue,
    avgRevenuePerDelivery,
    onTimeRate,
    satisfactionScore,
    damageRate,
    monthlyVolume,
    zoneDistribution,
    source: "deliveries",
  });
}
