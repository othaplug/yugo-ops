import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const { partnerId: orgId } = await params;
  const period = Number(req.nextUrl.searchParams.get("period") || 90);
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const admin = createAdminClient();

  const { data: deliveries } = await admin
    .from("deliveries")
    .select("id, status, scheduled_date, time_slot, delivery_window, completed_at, total_price, zone, booking_type")
    .eq("organization_id", orgId)
    .in("status", ["delivered", "completed"])
    .gte("scheduled_date", since);

  const all = deliveries || [];
  const total = all.length;
  const revenue = all.reduce((s, d) => s + Number(d.total_price || 0), 0);
  const avgRevenuePerDelivery = total > 0 ? Math.round(revenue / total) : 0;

  let onTimeCount = 0;
  for (const d of all) {
    if (!d.completed_at) { onTimeCount++; continue; }
    const hour = new Date(d.completed_at).getHours();
    const w = d.delivery_window || d.time_slot || "";
    const ok = w.includes("morning") ? hour < 12 : w.includes("afternoon") ? hour < 17 : hour < 18;
    if (ok) onTimeCount++;
  }
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  // Satisfaction
  const ids = all.map((d) => d.id);
  let satisfactionScore: number | null = null;
  if (ids.length > 0) {
    const { data: pods } = await admin
      .from("proof_of_delivery")
      .select("satisfaction_rating")
      .in("delivery_id", ids)
      .not("satisfaction_rating", "is", null);
    if (pods && pods.length >= 5) {
      const sum = pods.reduce((s, p) => s + (p.satisfaction_rating || 0), 0);
      satisfactionScore = Math.round((sum / pods.length) * 10) / 10;
    }
  }

  // Damage rate
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

  // Monthly volume
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
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short" }),
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
  });
}
