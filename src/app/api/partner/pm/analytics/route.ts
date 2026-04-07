import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { inferMoveOnTimeFromCompletion } from "@/lib/partner/pm-move-on-time";

/** PM partner analytics — same response shape as `/api/partner/analytics`, sourced from contract moves. */
export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const period = Number(req.nextUrl.searchParams.get("period") || 30);
  const sinceMs = Date.now() - period * 24 * 60 * 60 * 1000;
  const sinceDate = new Date(sinceMs).toISOString().split("T")[0];
  const sinceIso = new Date(sinceMs).toISOString();
  const admin = createAdminClient();

  const moveSelect =
    "id, status, scheduled_date, scheduled_time, completed_at, amount, estimate, partner_property_id, pm_reason_code, pm_move_kind, created_at";

  const [{ data: bySchedule }, { data: byCompletion }] = await Promise.all([
    admin
      .from("moves")
      .select(moveSelect)
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .in("status", ["completed", "paid", "delivered"])
      .gte("scheduled_date", sinceDate)
      .order("scheduled_date", { ascending: false }),
    admin
      .from("moves")
      .select(moveSelect)
      .eq("organization_id", orgId)
      .not("contract_id", "is", null)
      .in("status", ["completed", "paid", "delivered"])
      .gte("completed_at", sinceIso)
      .order("completed_at", { ascending: false }),
  ]);

  const byId = new Map<string, NonNullable<typeof bySchedule>[number]>();
  for (const d of [...(bySchedule || []), ...(byCompletion || [])]) {
    byId.set(d.id as string, d);
  }
  const allMoves = Array.from(byId.values()).sort((a, b) => {
    const ad = String(a.scheduled_date || "").localeCompare(String(b.scheduled_date || ""));
    return -ad;
  });
  const total = allMoves.length;

  const onTimeCount = allMoves.filter((m) => {
    if (!m.completed_at) return true;
    return inferMoveOnTimeFromCompletion({
      completed_at: m.completed_at as string,
      scheduled_time: m.scheduled_time as string | null,
    });
  }).length;
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

  const moveIds = allMoves.map((m) => m.id as string);
  let satisfactionScore: number | null = null;
  let satisfactionCount = 0;
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const recentComments: { name: string; date: string; rating: number; comment: string }[] = [];
  const ratingByMove = new Map<string, number>();

  if (moveIds.length > 0) {
    const { data: reviews } = await admin
      .from("review_requests")
      .select("move_id, client_rating, client_feedback, client_name, created_at")
      .in("move_id", moveIds)
      .not("client_rating", "is", null);

    const latestFeedbackByMove = new Map<
      string,
      {
        client_feedback: string;
        client_name: string | null;
        created_at: string | null;
        client_rating: number | null;
      }
    >();

    for (const r of reviews || []) {
      const mid = r.move_id as string | null;
      if (!mid) continue;
      const cr = Number(r.client_rating);
      if (cr >= 1 && cr <= 5 && !ratingByMove.has(mid)) {
        ratingByMove.set(mid, cr);
      }
      if (r.client_feedback && cr >= 1 && cr <= 5 && !latestFeedbackByMove.has(mid)) {
        latestFeedbackByMove.set(mid, {
          client_feedback: r.client_feedback as string,
          client_name: (r.client_name as string | null) ?? null,
          created_at: (r.created_at as string | null) ?? null,
          client_rating: cr,
        });
      }
    }

    let sum = 0;
    for (const [, r] of ratingByMove) {
      sum += r;
      satisfactionCount++;
      ratingDist[r] = (ratingDist[r] || 0) + 1;
    }
    satisfactionScore =
      satisfactionCount > 0 ? Math.round((sum / satisfactionCount) * 10) / 10 : null;

    for (const p of latestFeedbackByMove.values()) {
      const r = Number(p.client_rating);
      if (r < 1 || r > 5 || !p.client_feedback) continue;
      recentComments.push({
        name: p.client_name || "Resident",
        date: p.created_at
          ? new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "-",
        rating: r,
        comment: p.client_feedback,
      });
    }
  }

  const damageCount = 0;
  const damageRate = total > 0 ? Math.round((damageCount / total) * 1000) / 10 : 0;

  let avgDeliveryMinutes = 0;
  if (moveIds.length > 0) {
    const { data: sessions } = await admin
      .from("tracking_sessions")
      .select("started_at, completed_at")
      .in("job_id", moveIds)
      .eq("job_type", "move")
      .not("completed_at", "is", null);

    if (sessions && sessions.length > 0) {
      let totalMin = 0;
      let count = 0;
      for (const s of sessions) {
        if (s.started_at && s.completed_at) {
          const dur =
            (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000;
          if (dur > 0 && dur < 600) {
            totalMin += dur;
            count++;
          }
        }
      }
      avgDeliveryMinutes = count > 0 ? Math.round(totalMin / count) : 0;
    }
  }

  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { data: allForVolume } = await admin
    .from("moves")
    .select("scheduled_date, amount, estimate, partner_property_id")
    .eq("organization_id", orgId)
    .not("contract_id", "is", null)
    .in("status", ["completed", "paid", "delivered"])
    .gte("scheduled_date", yearAgo);

  const { data: props } = await admin
    .from("partner_properties")
    .select("id, building_name, service_region")
    .eq("partner_id", orgId);

  const propById = new Map((props ?? []).map((p) => [p.id as string, p]));

  const monthlyMap: Record<string, { count: number; totalCost: number }> = {};
  const zoneMap: Record<string, number> = {};

  for (const m of allForVolume || []) {
    const month = (m.scheduled_date as string | null)?.slice(0, 7);
    if (!month) continue;
    if (!monthlyMap[month]) monthlyMap[month] = { count: 0, totalCost: 0 };
    const amt = Number(m.amount || m.estimate || 0);
    monthlyMap[month].count++;
    monthlyMap[month].totalCost += amt;

    const pid = m.partner_property_id as string | null;
    const p = pid ? propById.get(pid) : null;
    const zone =
      (p?.service_region as string | null)?.trim() ||
      (p?.building_name as string | null)?.trim() ||
      "Portfolio";
    const z = zone.length > 28 ? `${zone.slice(0, 25)}…` : zone;
    zoneMap[z] = (zoneMap[z] || 0) + 1;
  }

  const months = Object.keys(monthlyMap).sort();
  const monthlyVolume = months.map((m) => ({
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short" }),
    count: monthlyMap[m].count,
  }));
  const monthlyCost = months.map((m) => ({
    month: new Date(m + "-15").toLocaleDateString("en-US", { month: "short" }),
    avgCost:
      monthlyMap[m].count > 0 ? Math.round(monthlyMap[m].totalCost / monthlyMap[m].count) : 0,
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

  const recentSlice = allMoves.slice(0, 20);
  const recentIds = recentSlice.map((m) => m.id as string);
  const minutesByMove = new Map<string, number>();
  if (recentIds.length > 0) {
    const { data: recentSessions } = await admin
      .from("tracking_sessions")
      .select("job_id, started_at, completed_at")
      .in("job_id", recentIds)
      .eq("job_type", "move")
      .not("completed_at", "is", null);
    for (const s of recentSessions || []) {
      const jid = s.job_id as string | null;
      if (!jid || minutesByMove.has(jid)) continue;
      if (s.started_at && s.completed_at) {
        const dur =
          (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000;
        if (dur > 0 && dur < 600) minutesByMove.set(jid, Math.round(dur));
      }
    }
  }

  const { data: globals } = await admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);
  const { data: customs } = await admin
    .from("pm_move_reasons")
    .select("reason_code, label")
    .eq("partner_id", orgId)
    .eq("active", true);
  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  const recentDeliveries = recentSlice.map((m) => {
    const isOnTime =
      !m.completed_at ||
      inferMoveOnTimeFromCompletion({
        completed_at: m.completed_at as string,
        scheduled_time: m.scheduled_time as string | null,
      });
    const rowRating = ratingByMove.get(m.id as string) ?? null;
    const rc = (m.pm_reason_code as string) || "";
    const typeLabel =
      reasonLabels[rc] || (m.pm_move_kind as string) || "Residential move";
    const prop = m.partner_property_id
      ? propById.get(m.partner_property_id as string)
      : null;
    const region = (prop?.service_region as string)?.trim() || "—";
    return {
      date: m.scheduled_date
        ? new Date(String(m.scheduled_date) + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "-",
      type: typeLabel,
      zone: region,
      minutes: minutesByMove.get(m.id as string) ?? 0,
      onTime: isOnTime,
      rating: rowRating,
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
