import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "lead") {
    return NextResponse.json({ error: "Only crew lead can submit end-of-day report" }, { status: 403 });
  }

  const body = await req.json();
  const crewNote = (body.crewNote || body.crew_note || "").toString().trim() || null;

  const today = new Date().toISOString().split("T")[0];
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("end_of_day_reports")
    .select("id")
    .eq("team_id", payload.teamId)
    .eq("report_date", today)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Report already submitted for today" }, { status: 400 });

  const [readinessRes, expensesRes, sessionsRes] = await Promise.all([
    admin.from("readiness_checks").select("passed, flagged_items").eq("team_id", payload.teamId).eq("check_date", today).maybeSingle(),
    admin.from("crew_expenses").select("category, amount_cents, description").eq("team_id", payload.teamId).gte("submitted_at", today).lte("submitted_at", today + "T23:59:59.999Z"),
    admin.from("tracking_sessions").select("job_id, job_type, started_at, status, checkpoints").eq("team_id", payload.teamId).gte("started_at", today),
  ]);

  const readiness = readinessRes.data;
  const expenses = expensesRes.data || [];
  const sessions = sessionsRes.data || [];

  const jobIds = [...new Set(sessions.map((s) => s.job_id))];
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
    const endTime = end && typeof end === "object" && "timestamp" in end ? new Date((end as { timestamp: string }).timestamp).getTime() : Date.now();
    const duration = Math.round((endTime - start) / 60000);
    return {
      jobId: s.job_id,
      type: s.job_type,
      duration,
      status: s.status,
      signOff: !!so,
      rating: so?.satisfaction_rating ?? null,
    };
  });

  const totalJobTime = jobsSummary.reduce((s, j) => s + (j.duration || 0), 0);
  const ratings = (signOffs || []).map((s) => s.satisfaction_rating).filter((r) => r != null) as number[];
  const averageSatisfaction = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

  const { data: photos } = await admin.from("job_photos").select("id").in("job_id", jobIds);
  const photosCount = photos?.length ?? 0;

  const summary = {
    jobsCompleted: completedSessions.length,
    totalJobTime,
    totalDriveTime: 0,
    photosCount,
    issuesReported: 0,
    expensesTotal: expenses.reduce((s, e) => s + (e.amount_cents || 0), 0),
    clientSignOffs: signOffs?.length ?? 0,
    averageSatisfaction: Math.round(averageSatisfaction * 10) / 10,
  };

  const expensesJson = expenses.map((e) => ({
    category: e.category,
    amount: e.amount_cents,
    description: e.description,
  }));

  const { data: report, error } = await admin
    .from("end_of_day_reports")
    .insert({
      team_id: payload.teamId,
      crew_lead_id: payload.crewMemberId,
      report_date: today,
      summary,
      jobs: jobsSummary,
      readiness: readiness ? { passed: readiness.passed, flaggedItems: readiness.flagged_items || [] } : null,
      expenses: expensesJson,
      crew_note: crewNote,
    })
    .select("id, report_date, generated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(report);
}
