import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function GET(req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const period = Number(req.nextUrl.searchParams.get("period") || 30);
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const admin = createAdminClient();

  // Completed deliveries in period
  const { data: deliveries } = await admin
    .from("deliveries")
    .select("id, status, scheduled_date, time_slot, delivery_window, completed_at, delivery_type, zone, total_price, booking_type, created_at")
    .eq("organization_id", primaryOrgId)
    .in("status", ["delivered", "completed"])
    .gte("scheduled_date", since)
    .order("scheduled_date", { ascending: false });

  const allDeliveries = deliveries || [];
  const total = allDeliveries.length;

  // On-time calculation
  let onTimeCount = 0;
  for (const d of allDeliveries) {
    if (!d.completed_at) { onTimeCount++; continue; }
    const completed = new Date(d.completed_at);
    const hour = completed.getHours();
    const window = d.delivery_window || d.time_slot || "";
    const isOnTime =
      window.includes("morning") ? hour < 12 :
      window.includes("afternoon") ? hour < 17 :
      hour < 18;
    if (isOnTime) onTimeCount++;
  }
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  // Satisfaction from proof_of_delivery
  const deliveryIds = allDeliveries.map((d) => d.id);
  let satisfactionScore: number | null = null;
  let satisfactionCount = 0;
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const recentComments: { name: string; date: string; rating: number; comment: string }[] = [];

  if (deliveryIds.length > 0) {
    const { data: pods } = await admin
      .from("proof_of_delivery")
      .select("satisfaction_rating, satisfaction_comment, signer_name, completed_at, delivery_id")
      .in("delivery_id", deliveryIds)
      .not("satisfaction_rating", "is", null);

    if (pods && pods.length > 0) {
      let sum = 0;
      for (const p of pods) {
        const r = p.satisfaction_rating;
        if (r >= 1 && r <= 5) {
          sum += r;
          satisfactionCount++;
          ratingDist[r] = (ratingDist[r] || 0) + 1;
          if (p.satisfaction_comment) {
            recentComments.push({
              name: p.signer_name || "Customer",
              date: p.completed_at ? new Date(p.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
              rating: r,
              comment: p.satisfaction_comment,
            });
          }
        }
      }
      satisfactionScore = satisfactionCount > 0 ? Math.round((sum / satisfactionCount) * 10) / 10 : null;
    }
  }

  // Damage rate from proof_of_delivery
  let damageCount = 0;
  if (deliveryIds.length > 0) {
    const { data: damagePods } = await admin
      .from("proof_of_delivery")
      .select("item_conditions, delivery_id")
      .in("delivery_id", deliveryIds);

    for (const p of damagePods || []) {
      const conditions = Array.isArray(p.item_conditions) ? p.item_conditions : [];
      if (conditions.some((ic: { condition: string }) => ic.condition === "new_damage")) {
        damageCount++;
      }
    }
  }
  const damageRate = total > 0 ? Math.round((damageCount / total) * 1000) / 10 : 0;

  // Avg delivery time (from tracking sessions)
  let avgDeliveryMinutes = 0;
  if (deliveryIds.length > 0) {
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("started_at, completed_at")
      .in("job_id", deliveryIds)
      .eq("job_type", "delivery")
      .not("completed_at", "is", null);

    if (sessions && sessions.length > 0) {
      let totalMin = 0;
      let count = 0;
      for (const s of sessions) {
        if (s.started_at && s.completed_at) {
          const dur = (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000;
          if (dur > 0 && dur < 600) { totalMin += dur; count++; }
        }
      }
      avgDeliveryMinutes = count > 0 ? Math.round(totalMin / count) : 0;
    }
  }

  // Monthly volume (12 months)
  const { data: allForVolume } = await admin
    .from("deliveries")
    .select("scheduled_date, total_price, zone")
    .eq("organization_id", primaryOrgId)
    .in("status", ["delivered", "completed"])
    .gte("scheduled_date", new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  const monthlyMap: Record<string, { count: number; totalCost: number }> = {};
  const zoneMap: Record<string, number> = {};

  for (const d of allForVolume || []) {
    const month = (d.scheduled_date || "").slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { count: 0, totalCost: 0 };
    monthlyMap[month].count++;
    monthlyMap[month].totalCost += Number(d.total_price || 0);

    const zone = `Zone ${d.zone || 1}`;
    zoneMap[zone] = (zoneMap[zone] || 0) + 1;
  }

  const months = Object.keys(monthlyMap).sort();
  const monthlyVolume = months.map((m) => ({
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short" }),
    count: monthlyMap[m].count,
  }));
  const monthlyCost = months.map((m) => ({
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short" }),
    avgCost: monthlyMap[m].count > 0 ? Math.round(monthlyMap[m].totalCost / monthlyMap[m].count) : 0,
  }));

  const totalZone = Object.values(zoneMap).reduce((s, v) => s + v, 0);
  const zoneDistribution = Object.entries(zoneMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([zone, count]) => ({
      zone,
      count,
      pct: totalZone > 0 ? Math.round((count / totalZone) * 100) : 0,
    }));

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: ratingDist[stars] || 0,
  }));

  // Recent deliveries table
  const recentDeliveries = allDeliveries.slice(0, 20).map((d) => {
    const completed = d.completed_at ? new Date(d.completed_at) : null;
    const window = d.delivery_window || d.time_slot || "";
    const isOnTime = !completed || (
      window.includes("morning") ? completed.getHours() < 12 :
      window.includes("afternoon") ? completed.getHours() < 17 :
      completed.getHours() < 18
    );
    return {
      date: d.scheduled_date ? new Date(d.scheduled_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
      type: d.booking_type === "day_rate" ? "Day Rate" : d.delivery_type || "delivery",
      zone: d.zone || 1,
      minutes: 0,
      onTime: isOnTime,
      rating: null as number | null,
      hasDamage: false,
    };
  });

  return NextResponse.json({
    onTimeRate,
    satisfactionScore,
    satisfactionCount,
    damageRate,
    avgDeliveryMinutes,
    monthlyVolume,
    monthlyCost,
    zoneDistribution,
    ratingDistribution,
    recentComments: recentComments.slice(0, 10),
    recentDeliveries,
  });
}
