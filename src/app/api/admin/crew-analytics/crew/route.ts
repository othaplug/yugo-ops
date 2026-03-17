import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getTodayString, getLocalDateString } from "@/lib/business-timezone";
import {
  parseTimeWindow,
  isArrivalWithinWindow,
  ARRIVAL_CHECKPOINTS_MOVE,
  ARRIVAL_CHECKPOINTS_DELIVERY,
} from "@/lib/parse-time-window";

type Checkpoint = {
  status: string;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
};

type Stage = {
  status: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null; // minutes
};

const STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "Travel to Pickup",
  arrived_at_pickup: "At Pickup",
  loading: "Loading",
  en_route_to_destination: "Transit",
  arrived_at_destination: "At Destination",
  unloading: "Unloading",
  completed: "Complete",
  en_route: "En Route",
  arrived: "Arrived",
  delivering: "Delivering",
};

/**
 * Get first arrival timestamp from checkpoints. Uses both:
 * - Manual: when crew taps "Arrived at Pickup" / "Arrived at Destination" in the app
 * - GPS: when live tracker auto-detects arrival within 100m (tracking/location route)
 */
function getFirstArrivalMs(checkpoints: Checkpoint[], statuses: readonly string[]): number | null {
  if (!checkpoints?.length) return null;
  for (const status of statuses) {
    const cp = checkpoints.find((c) => c.status === status);
    if (cp?.timestamp) return new Date(cp.timestamp).getTime();
  }
  return null;
}

function buildStages(
  checkpoints: Checkpoint[],
  sessionStart: string,
): Stage[] {
  if (!checkpoints || checkpoints.length === 0) return [];
  const pts: { status: string; timestamp: string }[] = [
    { status: "started", timestamp: sessionStart },
    ...checkpoints,
  ];
  const stages: Stage[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const from = pts[i];
    const to = pts[i + 1];
    const label = STAGE_LABELS[to.status] || STAGE_LABELS[from.status] || from.status.replace(/_/g, " ");
    const startMs = new Date(from.timestamp).getTime();
    const endMs = new Date(to.timestamp).getTime();
    const duration = Math.round((endMs - startMs) / 60000);
    stages.push({
      status: to.status,
      label,
      startedAt: from.timestamp,
      endedAt: to.timestamp,
      duration,
    });
  }
  return stages;
}

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const url = new URL(req.url);
  const crewId = url.searchParams.get("id");
  if (!crewId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const today = getTodayString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const from = url.searchParams.get("from") || getLocalDateString(thirtyDaysAgo);
  const to = url.searchParams.get("to") || today;

  const admin = createAdminClient();

  const [crewRes, sessionsRes, signOffsRes, tipsRes] = await Promise.all([
    admin.from("crews").select("id, name, members").eq("id", crewId).single(),
    admin
      .from("tracking_sessions")
      .select("id, job_id, job_type, team_id, status, started_at, completed_at, checkpoints")
      .eq("team_id", crewId)
      .gte("started_at", from)
      .lte("started_at", to + "T23:59:59.999Z")
      .order("started_at", { ascending: false }),
    admin
      .from("client_sign_offs")
      .select("job_id, job_type, satisfaction_rating, signed_at")
      .gte("signed_at", from)
      .lte("signed_at", to + "T23:59:59.999Z"),
    admin
      .from("tips")
      .select("move_id, amount, charged_at")
      .eq("crew_id", crewId)
      .gte("charged_at", from)
      .lte("charged_at", to + "T23:59:59.999Z"),
  ]);

  const crew = crewRes.data;
  if (!crew) return NextResponse.json({ error: "Crew not found" }, { status: 404 });

  const sessions = sessionsRes.data || [];
  const signOffs = signOffsRes.data || [];
  const tips = tipsRes.data || [];
  const totalTipsFromTable = tips.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const tipByMoveId = new Map<string, number>();
  tips.forEach((t) => {
    if (t.move_id) tipByMoveId.set(t.move_id, Number(t.amount) || 0);
  });

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const moveIds = completedSessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = completedSessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const [movesRes, deliveriesRes, podsMoveRes, podsDeliveryRes, benchmarksRes] = await Promise.all([
    moveIds.length > 0
      ? admin
          .from("moves")
          .select("id, client_name, from_address, to_address, move_date, quoted_hours, move_size, arrival_window, scheduled_date, scheduled_time")
          .in("id", moveIds)
      : Promise.resolve({ data: [] }),
    deliveryIds.length > 0
      ? admin
          .from("deliveries")
          .select("id, customer_name, client_name, pickup_address, delivery_address, scheduled_date, delivery_window, time_slot")
          .in("id", deliveryIds)
      : Promise.resolve({ data: [] }),
    moveIds.length > 0
      ? admin.from("proof_of_delivery").select("move_id, satisfaction_rating").in("move_id", moveIds).not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
    deliveryIds.length > 0
      ? admin.from("proof_of_delivery").select("delivery_id, satisfaction_rating").in("delivery_id", deliveryIds).not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
    admin.from("volume_benchmarks").select("move_size, baseline_hours"),
  ]);

  const moveMap = new Map((movesRes.data || []).map((m) => [m.id, m]));
  const deliveryMap = new Map((deliveriesRes.data || []).map((d) => [d.id, d]));
  const baselineBySize = new Map<string, number>();
  (benchmarksRes.data || []).forEach((b) => {
    if (b.move_size && b.baseline_hours != null) baselineBySize.set(b.move_size, Number(b.baseline_hours));
  });

  const signOffByJob = new Map<string, { rating: number | null }>();
  signOffs.forEach((s) => signOffByJob.set(`${s.job_id}:${s.job_type}`, { rating: s.satisfaction_rating }));

  const podRatingByMove = new Map<string, number>();
  (podsMoveRes.data || []).forEach((p) => {
    if (p.move_id && p.satisfaction_rating != null) podRatingByMove.set(p.move_id, p.satisfaction_rating);
  });
  const podRatingByDelivery = new Map<string, number>();
  (podsDeliveryRes.data || []).forEach((p) => {
    if (p.delivery_id && p.satisfaction_rating != null) podRatingByDelivery.set(p.delivery_id, p.satisfaction_rating);
  });

  function getRating(jobId: string, jobType: string): number | null {
    const so = signOffByJob.get(`${jobId}:${jobType}`);
    if (so?.rating != null) return so.rating;
    if (jobType === "move") return podRatingByMove.get(jobId) ?? null;
    return podRatingByDelivery.get(jobId) ?? null;
  }

  const jobs = completedSessions.map((s) => {
    const cps = (s.checkpoints as Checkpoint[]) || [];
    const stages = buildStages(cps, s.started_at || s.completed_at || new Date().toISOString());

    const startMs = s.started_at ? new Date(s.started_at).getTime() : null;
    const endMs = s.completed_at
      ? new Date(s.completed_at).getTime()
      : cps.length > 0
        ? new Date(cps[cps.length - 1].timestamp).getTime()
        : null;
    const totalDuration = startMs && endMs ? Math.round((endMs - startMs) / 60000) : null;

    const so = signOffByJob.get(`${s.job_id}:${s.job_type}`);

    if (s.job_type === "move") {
      const m = moveMap.get(s.job_id);
      const quotedHours = m?.quoted_hours ?? (m?.move_size ? baselineBySize.get(m.move_size) ?? null : null);
      const quotedMinutes = quotedHours != null ? quotedHours * 60 : null;

      let onTime: boolean | null = null;
      const dateStr = m?.move_date || s.started_at?.split("T")[0];
      const windowStr = m?.arrival_window || m?.scheduled_time;
      const arrivalMs = getFirstArrivalMs(cps, ARRIVAL_CHECKPOINTS_MOVE);
      const parsed = dateStr && windowStr ? parseTimeWindow(windowStr, dateStr) : null;
      if (parsed && arrivalMs != null) {
        onTime = isArrivalWithinWindow(arrivalMs, parsed);
      } else if (totalDuration != null && quotedMinutes != null) {
        onTime = totalDuration <= quotedMinutes + 30;
      }

      return {
        sessionId: s.id,
        jobId: s.job_id,
        jobType: "move" as const,
        date: dateStr || null,
        clientName: m?.client_name || "—",
        route: m ? `${m.from_address || "?"} → ${m.to_address || "?"}` : "—",
        totalDuration,
        quotedMinutes,
        onTime,
        rating: getRating(s.job_id, s.job_type),
        tip: tipByMoveId.get(s.job_id) ?? 0,
        hasSignOff: !!so,
        stages,
      };
    } else {
      const d = deliveryMap.get(s.job_id);
      const dateStr = d?.scheduled_date || s.started_at?.split("T")[0];
      const windowStr = d?.delivery_window || d?.time_slot;
      const arrivalMs = getFirstArrivalMs(cps, ARRIVAL_CHECKPOINTS_DELIVERY);
      const parsed = dateStr && windowStr ? parseTimeWindow(windowStr, dateStr) : null;
      const onTime =
        parsed && arrivalMs != null ? isArrivalWithinWindow(arrivalMs, parsed) : null;

      return {
        sessionId: s.id,
        jobId: s.job_id,
        jobType: "delivery" as const,
        date: dateStr || null,
        clientName: d?.customer_name || d?.client_name || "—",
        route: d ? `${d.pickup_address || "?"} → ${d.delivery_address || "?"}` : "—",
        totalDuration,
        quotedMinutes: null,
        onTime,
        rating: getRating(s.job_id, s.job_type),
        tip: 0,
        hasSignOff: !!so,
        stages,
      };
    }
  });

  // Build weekly trend data
  const weekMap = new Map<
    string,
    { jobs: number; totalDuration: number; ratings: number[]; tips: number }
  >();
  jobs.forEach((j) => {
    if (!j.date) return;
    const d = new Date(j.date + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const wk = weekStart.toISOString().split("T")[0];
    if (!weekMap.has(wk)) weekMap.set(wk, { jobs: 0, totalDuration: 0, ratings: [], tips: 0 });
    const w = weekMap.get(wk)!;
    w.jobs += 1;
    if (j.totalDuration) w.totalDuration += j.totalDuration;
    if (j.rating != null) w.ratings.push(j.rating);
    w.tips += j.tip;
  });
  const trends = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, w]) => ({
      week,
      weekLabel: new Date(week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      jobs: w.jobs,
      avgDuration: w.jobs > 0 ? Math.round(w.totalDuration / w.jobs) : null,
      avgRating:
        w.ratings.length > 0
          ? Math.round((w.ratings.reduce((a, b) => a + b, 0) / w.ratings.length) * 10) / 10
          : null,
      tips: w.tips,
    }));

  const totalTips = totalTipsFromTable;
  const onTimeJobs = jobs.filter((j) => j.onTime === true).length;
  const timedJobs = jobs.filter((j) => j.onTime !== null).length;
  const onTimeRate = timedJobs > 0 ? Math.round((onTimeJobs / timedJobs) * 100) : null;
  const allRatings = jobs.filter((j) => j.rating != null).map((j) => j.rating!);
  const avgRating =
    allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null;

  return NextResponse.json({
    crew: { id: crew.id, name: crew.name, members: (crew.members as string[]) || [] },
    jobs,
    trends,
    summary: {
      totalJobs: jobs.length,
      avgRating,
      onTimeRate,
      totalTips,
    },
    from,
    to,
  });
}
