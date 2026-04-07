import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAvgDrivingSpeedKmhFromHistoryRows } from "@/lib/crew/avg-driving-speed";
import { formatJobId } from "@/lib/move-code";

type AdminClient = SupabaseClient;

export type EndOfDayUpsertResult =
  | { ok: true; id: string; report_date: string; generated_at: string }
  | { ok: false; error: string };

/**
 * Builds payload and inserts or updates `end_of_day_reports` for a team/date.
 * Mirrors POST /api/crew/reports/end-of-day (lead-only fields supplied by caller).
 */
export async function upsertEndOfDayReportForTeam(
  admin: AdminClient,
  opts: {
    teamId: string;
    crewLeadId: string;
    today: string;
    crewNote: string | null;
    jobNotes?: Record<string, string>;
  },
): Promise<EndOfDayUpsertResult> {
  const { teamId, crewLeadId, today, crewNote } = opts;
  const jobNotes: Record<string, string> =
    opts.jobNotes && typeof opts.jobNotes === "object"
      ? Object.fromEntries(
          Object.entries(opts.jobNotes)
            .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
            .map(([k, v]) => [k, (v as string).trim()]),
        )
      : {};

  const { data: existing } = await admin
    .from("end_of_day_reports")
    .select("id")
    .eq("team_id", teamId)
    .eq("report_date", today)
    .maybeSingle();

  const [readinessRes, expensesRes, sessionsRes] = await Promise.all([
    admin.from("readiness_checks").select("passed, flagged_items").eq("team_id", teamId).eq("check_date", today).maybeSingle(),
    admin
      .from("crew_expenses")
      .select("category, amount_cents, description")
      .eq("team_id", teamId)
      .gte("submitted_at", today)
      .lte("submitted_at", today + "T23:59:59.999Z"),
    admin
      .from("tracking_sessions")
      .select("id, job_id, job_type, started_at, status, checkpoints")
      .eq("team_id", teamId)
      .gte("started_at", today),
  ]);

  const readiness = readinessRes.data;
  const expenses = expensesRes.data || [];
  const sessions = sessionsRes.data || [];

  const jobIds = [...new Set(sessions.map((s) => s.job_id))];
  const moveIds = sessions.filter((s) => s.job_type === "move").map((s) => s.job_id);
  const deliveryIds = sessions.filter((s) => s.job_type === "delivery").map((s) => s.job_id);

  const [movesRes, deliveriesRes] = await Promise.all([
    moveIds.length ? admin.from("moves").select("id, move_code").in("id", [...new Set(moveIds)]) : { data: [] as { id: string; move_code?: string | null }[] },
    deliveryIds.length
      ? admin.from("deliveries").select("id, delivery_number").in("id", [...new Set(deliveryIds)])
      : { data: [] as { id: string; delivery_number?: string | null }[] },
  ]);
  const jobDisplayMap = new Map<string, string>();
  (movesRes.data || []).forEach((m) => jobDisplayMap.set(m.id, formatJobId(m.move_code || m.id, "move")));
  (deliveriesRes.data || []).forEach((d) => jobDisplayMap.set(d.id, formatJobId(d.delivery_number || d.id, "delivery")));

  let signOffs: { job_id: string; job_type: string; satisfaction_rating: number | null; signed_by: string }[] = [];
  if (jobIds.length > 0) {
    const { data: so } = await admin.from("client_sign_offs").select("job_id, job_type, satisfaction_rating, signed_by").in("job_id", jobIds);
    signOffs = so || [];
  }

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const jobsSummary = completedSessions.map((s) => {
    const so = (signOffs || []).find((x) => x.job_id === s.job_id && x.job_type === s.job_type);
    const start = s.started_at ? new Date(s.started_at).getTime() : 0;
    const end = (s.checkpoints as { timestamp?: string }[])?.[(s.checkpoints as unknown[]).length - 1];
    const endTime =
      end && typeof end === "object" && "timestamp" in end ? new Date((end as { timestamp: string }).timestamp).getTime() : Date.now();
    const duration = Math.round((endTime - start) / 60000);
    const displayId = jobDisplayMap.get(s.job_id) || s.job_id;
    const note = jobNotes[s.job_id] || null;
    return {
      jobId: s.job_id,
      displayId,
      type: s.job_type,
      sessionId: (s as { id?: string }).id ?? null,
      duration,
      status: s.status,
      signOff: !!so,
      rating: so?.satisfaction_rating ?? null,
      note: note || undefined,
    };
  });

  const totalJobTime = jobsSummary.reduce((s, j) => s + (j.duration || 0), 0);
  const ratings = (signOffs || []).map((s) => s.satisfaction_rating).filter((r) => r != null) as number[];
  const averageSatisfaction = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const { data: photos } = await admin.from("job_photos").select("id").in("job_id", jobIds);
  const photosCount = photos?.length ?? 0;

  const { data: speedRows } = await admin
    .from("crew_location_history")
    .select("lat, lng, speed, recorded_at")
    .eq("crew_id", teamId)
    .gte("recorded_at", `${today}T00:00:00`)
    .lte("recorded_at", `${today}T23:59:59.999Z`);

  const avgDrivingSpeedKmh = computeAvgDrivingSpeedKmhFromHistoryRows(speedRows || []);

  const summary = {
    jobsCompleted: completedSessions.length,
    totalJobTime,
    totalDriveTime: 0,
    photosCount,
    issuesReported: 0,
    expensesTotal: expenses.reduce((s, e) => s + (e.amount_cents || 0), 0),
    clientSignOffs: signOffs?.length ?? 0,
    averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
    /** Mean GPS speed while moving (2–28 m/s samples), km/h — ops visibility for driving pace. */
    avgDrivingSpeedKmh,
  };

  const expensesJson = expenses.map((e) => ({
    category: e.category,
    amount: e.amount_cents,
    description: e.description,
  }));

  const payloadRow = {
    crew_lead_id: crewLeadId,
    summary,
    jobs: jobsSummary,
    readiness: readiness ? { passed: readiness.passed, flaggedItems: readiness.flagged_items || [] } : null,
    expenses: expensesJson,
    crew_note: crewNote,
  };

  if (existing) {
    const { data: report, error } = await admin
      .from("end_of_day_reports")
      .update({
        ...payloadRow,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, report_date, generated_at")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: report.id, report_date: report.report_date, generated_at: report.generated_at };
  }

  const { data: report, error } = await admin
    .from("end_of_day_reports")
    .insert({
      team_id: teamId,
      report_date: today,
      ...payloadRow,
    })
    .select("id, report_date, generated_at")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: report.id, report_date: report.report_date, generated_at: report.generated_at };
}

function isTerminalMoveStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "cancelled";
}

function isTerminalDeliveryStatus(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "delivered" || s === "cancelled";
}

/**
 * Crew teams that had work on the board for `today` (scheduled today or open carryover)
 * or logged a tracking session starting on/after `today` (same filter as EOD report).
 */
export async function getCrewTeamIdsWithWorkToday(admin: AdminClient, today: string): Promise<string[]> {
  const teamIds = new Set<string>();

  const { data: sessionRows } = await admin.from("tracking_sessions").select("team_id").gte("started_at", today);
  for (const row of sessionRows || []) {
    if (row.team_id) teamIds.add(row.team_id);
  }

  const { data: movesToday } = await admin.from("moves").select("crew_id").eq("scheduled_date", today).not("crew_id", "is", null);
  for (const row of movesToday || []) {
    if (row.crew_id) teamIds.add(row.crew_id);
  }

  const { data: delToday } = await admin.from("deliveries").select("crew_id").eq("scheduled_date", today).not("crew_id", "is", null);
  for (const row of delToday || []) {
    if (row.crew_id) teamIds.add(row.crew_id);
  }

  const { data: movesCarry } = await admin.from("moves").select("crew_id, status").lt("scheduled_date", today).not("crew_id", "is", null);
  for (const row of movesCarry || []) {
    if (row.crew_id && !isTerminalMoveStatus(row.status)) teamIds.add(row.crew_id);
  }

  const { data: delCarry } = await admin.from("deliveries").select("crew_id, status").lt("scheduled_date", today).not("crew_id", "is", null);
  for (const row of delCarry || []) {
    if (row.crew_id && !isTerminalDeliveryStatus(row.status)) teamIds.add(row.crew_id);
  }

  return [...teamIds];
}

/** Resolve crew lead for EOD row; falls back to any active crew member on the team. */
export async function resolveCrewLeadIdForTeam(admin: AdminClient, teamId: string): Promise<string | null> {
  const { data: lead } = await admin.from("crew_members").select("id").eq("team_id", teamId).eq("role", "lead").limit(1).maybeSingle();
  if (lead?.id) return lead.id;
  const { data: anyMember } = await admin.from("crew_members").select("id").eq("team_id", teamId).limit(1).maybeSingle();
  return anyMember?.id ?? null;
}
