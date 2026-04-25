export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import { computeAvgDrivingSpeedKmhFromHistoryRows } from "@/lib/crew/avg-driving-speed";
import BackButton from "../components/BackButton";
import ReportsClient from "./ReportsClient";
import { formatJobId } from "@/lib/move-code";
import { labourCostForDelivery, labourCostForMove } from "@/lib/reports/crew-labour-financials";

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const today = getTodayString();
  const from = params.from || params.date || today;
  const to = params.to || params.date || today;
  const date = params.date || from;

  const supabase = createAdminClient();

  /* ── Crew EOD reports (existing) ── */
  let eodQuery = supabase
    .from("end_of_day_reports")
    .select(`
      id,
      team_id,
      report_date,
      summary,
      jobs,
      crew_note,
      readiness,
      expenses,
      generated_at,
      crews(name)
    `);

  if (from && to && from <= to) {
    eodQuery = eodQuery.gte("report_date", from).lte("report_date", to);
  } else {
    eodQuery = eodQuery.eq("report_date", date);
  }

  const sixAgo = sixMonthsAgo();
  const monthStart = startOfMonth();

  /* ── Parallel data fetches ── */
  const [
    { data: rawReports },
    { data: crewMovesRows },
    { data: crewDeliveryRows },
    { data: tipsRows },
    { data: crewExpenseRows },
    { data: crewHourlyRow },
    { data: opsMoves },
    { data: trackingSessions },
  ] = await Promise.all([
    eodQuery.order("report_date", { ascending: false }).order("generated_at", { ascending: false }),

    supabase
      .from("moves")
      .select(
        "id, scheduled_date, crew_id, actual_labour_cost, actual_hours, actual_crew_count, est_hours, crew_count, est_crew_size",
      )
      .gte("scheduled_date", sixAgo),

    supabase
      .from("deliveries")
      .select("id, scheduled_date, crew_id, actual_hours, actual_crew_count, booking_type")
      .gte("scheduled_date", sixAgo),

    supabase
      .from("tips")
      .select("id, net_amount, amount, charged_at, crew_id")
      .gte("charged_at", `${sixAgo}T00:00:00`),

    supabase
      .from("crew_expenses")
      .select("amount_cents, status, submitted_at")
      .eq("status", "approved")
      .gte("submitted_at", `${sixAgo}T00:00:00`),

    supabase.from("platform_config").select("value").eq("key", "crew_hourly_cost").maybeSingle(),

    supabase
      .from("moves")
      .select("id, status, scheduled_date, crew_id, completed_at")
      .gte("scheduled_date", monthStart),

    supabase
      .from("tracking_sessions")
      .select("id, job_id, job_type, status, started_at, completed_at, team_id")
      .gte("started_at", monthStart),
  ]);

  const crewHourly = parseFloat(String(crewHourlyRow?.value ?? "25")) || 25;

  type MonthAgg = { moves: number; deliveries: number; total: number; count: number };
  const monthlyLabourMap = new Map<string, MonthAgg>();
  const teamLabour = new Map<string, number>();
  const teamJobs = new Map<string, number>();

  let totalLabourPay = 0;

  for (const m of crewMovesRows || []) {
    const cost = labourCostForMove(m, crewHourly);
    totalLabourPay += cost;
    const mk = String(m.scheduled_date || "").slice(0, 7);
    if (mk.length === 7) {
      const cur = monthlyLabourMap.get(mk) || { moves: 0, deliveries: 0, total: 0, count: 0 };
      cur.moves += cost;
      cur.total += cost;
      cur.count += 1;
      monthlyLabourMap.set(mk, cur);
    }
    const cid = m.crew_id as string | null;
    if (cid) {
      teamLabour.set(cid, (teamLabour.get(cid) || 0) + cost);
      teamJobs.set(cid, (teamJobs.get(cid) || 0) + 1);
    }
  }

  for (const d of crewDeliveryRows || []) {
    const cost = labourCostForDelivery(d, crewHourly);
    totalLabourPay += cost;
    const mk = String(d.scheduled_date || "").slice(0, 7);
    if (mk.length === 7) {
      const cur = monthlyLabourMap.get(mk) || { moves: 0, deliveries: 0, total: 0, count: 0 };
      cur.deliveries += cost;
      cur.total += cost;
      cur.count += 1;
      monthlyLabourMap.set(mk, cur);
    }
    const cid = d.crew_id as string | null;
    if (cid) {
      teamLabour.set(cid, (teamLabour.get(cid) || 0) + cost);
      teamJobs.set(cid, (teamJobs.get(cid) || 0) + 1);
    }
  }

  const jobCountForLabour = (crewMovesRows?.length || 0) + (crewDeliveryRows?.length || 0);
  const avgLabourPerJob =
    jobCountForLabour > 0 ? Math.round((totalLabourPay / jobCountForLabour) * 100) / 100 : 0;

  const tipsInPeriod = (tipsRows || []).filter((t) => {
    const ts = t.charged_at ? new Date(t.charged_at as string).getTime() : 0;
    return ts >= new Date(`${sixAgo}T00:00:00`).getTime();
  });
  let totalTips = 0;
  for (const t of tipsInPeriod) {
    totalTips += Number(t.net_amount ?? t.amount ?? 0);
  }
  const tipCount = tipsInPeriod.length;
  const avgTip = tipCount > 0 ? Math.round((totalTips / tipCount) * 100) / 100 : 0;

  const expenseApprovedCents = (crewExpenseRows || []).reduce((s, e) => s + (Number(e.amount_cents) || 0), 0);
  const expenseCount = (crewExpenseRows || []).length;

  const monthlyLabour = Array.from(monthlyLabourMap.entries())
    .map(([month, val]) => ({ month, ...val }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 6);

  const labourCrewIds = [...new Set([...teamLabour.keys()])];
  let teamLabourLeaders: { crewId: string; name: string; labour: number; jobs: number }[] = [];
  if (labourCrewIds.length > 0) {
    const { data: labourCrews } = await supabase.from("crews").select("id, name").in("id", labourCrewIds);
    const nameById = new Map<string, string>();
    (labourCrews || []).forEach((c) => nameById.set(c.id as string, (c.name as string) || "Crew"));
    for (const [crewId, labour] of teamLabour.entries()) {
      teamLabourLeaders.push({
        crewId,
        name: nameById.get(crewId) || "Crew",
        labour: Math.round(labour * 100) / 100,
        jobs: teamJobs.get(crewId) || 0,
      });
    }
    teamLabourLeaders.sort((a, b) => b.labour - a.labour);
  }

  /* ── Enrich EOD reports (existing logic) ── */
  const reports = (rawReports || []).map((r) => {
    const crews = r.crews as { name?: string }[] | { name?: string } | null | undefined;
    const crew = Array.isArray(crews) ? crews[0] : crews;
    return { ...r, crews: crew ? { name: crew.name ?? "Team" } : null };
  });

  const jobIdsByType = { move: new Set<string>(), delivery: new Set<string>() };
  reports.forEach((r) => {
    const jobs = (r.jobs as { jobId: string; type: string }[]) || [];
    jobs.forEach((j) => {
      if (j.type === "move") jobIdsByType.move.add(j.jobId);
      else if (j.type === "delivery") jobIdsByType.delivery.add(j.jobId);
    });
  });
  const moveIds = Array.from(jobIdsByType.move);
  const deliveryIds = Array.from(jobIdsByType.delivery);
  const allJobIds = [...moveIds, ...deliveryIds];

  const [movesRes, deliveriesRes, damageRes] = await Promise.all([
    moveIds.length ? supabase.from("moves").select("id, move_code, client_name").in("id", moveIds) : { data: [] },
    deliveryIds.length ? supabase.from("deliveries").select("id, delivery_number, customer_name, client_name").in("id", deliveryIds) : { data: [] },
    allJobIds.length ? supabase.from("incidents").select("job_id, job_type").eq("issue_type", "damage").in("job_id", allJobIds) : { data: [] },
  ]);

  const damageJobKeys = new Set<string>();
  (damageRes.data || []).forEach((d: { job_id: string; job_type: string }) => damageJobKeys.add(`${d.job_id}:${d.job_type}`));

  const movesMap = new Map<string, { displayId: string; clientName: string }>();
  (movesRes.data || []).forEach((m) => {
    const entry = { displayId: formatJobId(m.move_code || m.id, "move"), clientName: m.client_name || "-" };
    movesMap.set(m.id, entry);
    if (m.move_code) movesMap.set(String(m.move_code).trim().toUpperCase().replace(/^#/, ""), entry);
  });

  const deliveriesMap = new Map<string, { displayId: string; clientName: string }>();
  (deliveriesRes.data || []).forEach((d) => {
    const entry = {
      displayId: d.delivery_number ? formatJobId(d.delivery_number, "delivery") : "Delivery",
      clientName: [d.customer_name, d.client_name].filter(Boolean).join(", ") || "-",
    };
    deliveriesMap.set(d.id, entry);
    if (d.delivery_number) deliveriesMap.set(String(d.delivery_number).trim(), entry);
  });

  const reportsEnriched = reports.map((r) => {
    const jobs = ((r.jobs as { jobId: string; type: string; sessionId?: string; duration: number; signOff?: boolean; rating?: number | null }[]) || []).map((j) => {
      const map = j.type === "move" ? movesMap : deliveriesMap;
      const meta = map.get(j.jobId) ?? map.get(j.jobId.toUpperCase().replace(/^#/, "").trim());
      const hasDamage = damageJobKeys.has(`${j.jobId}:${j.type}`);
      return {
        ...j,
        displayId: meta?.displayId ?? (j.type === "move" ? "Move" : "Delivery"),
        clientName: meta?.clientName ?? "-",
        hasDamage,
      };
    });
    return { ...r, jobs };
  });

  const needsAvgSpeed = reportsEnriched.filter((r) => {
    const sum = (r.summary as Record<string, unknown> | undefined) || {};
    const raw = sum.avgDrivingSpeedKmh;
    if (typeof raw === "number" && Number.isFinite(raw)) return false;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return false;
    return true;
  });

  let finalReports = reportsEnriched;
  if (needsAvgSpeed.length > 0) {
    const teamIds = [...new Set(needsAvgSpeed.map((r) => r.team_id))];
    const { data: locRows } = await supabase
      .from("crew_location_history")
      .select("crew_id, lat, lng, speed, recorded_at")
      .in("crew_id", teamIds)
      .gte("recorded_at", `${from}T00:00:00`)
      .lte("recorded_at", `${to}T23:59:59.999Z`);

    finalReports = reportsEnriched.map((r) => {
      const sum = (r.summary as Record<string, unknown> | undefined) || {};
      const raw = sum.avgDrivingSpeedKmh;
      if (typeof raw === "number" && Number.isFinite(raw)) return r;
      if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return r;

      const rows = (locRows || []).filter((row) => {
        if ((row.crew_id as string) !== r.team_id) return false;
        const rec = String(row.recorded_at);
        return rec >= `${r.report_date}T00:00:00` && rec <= `${r.report_date}T23:59:59.999Z`;
      });
      const computed = computeAvgDrivingSpeedKmhFromHistoryRows(rows);
      if (computed == null) return r;
      return { ...r, summary: { ...sum, avgDrivingSpeedKmh: computed } };
    });
  }

  const totalJobs = finalReports.reduce((s, r) => s + ((r.jobs as unknown[]) || []).length, 0);
  const teamCount = new Set(finalReports.map((r) => r.team_id)).size;

  const crewFinancial = {
    crewHourlyCost: crewHourly,
    totalLabourPay: Math.round(totalLabourPay * 100) / 100,
    jobCount: jobCountForLabour,
    avgLabourPerJob,
    totalTips: Math.round(totalTips * 100) / 100,
    tipCount,
    avgTip,
    expenseReimbursements: Math.round(expenseApprovedCents) / 100,
    expenseCount,
    monthlyLabour,
    teamLabourLeaders: teamLabourLeaders.slice(0, 12),
  };

  /* ── Operations data ── */
  const opsMovesData = (opsMoves || []).map((m) => ({
    id: m.id as string,
    status: m.status as string,
    crew_id: m.crew_id as string | null,
    scheduled_date: m.scheduled_date as string,
    completed_at: m.completed_at as string | null,
  }));

  const sessions = (trackingSessions || []).map((s) => ({
    id: s.id as string,
    job_id: s.job_id as string,
    job_type: s.job_type as string,
    status: s.status as string,
    started_at: s.started_at as string | null,
    completed_at: s.completed_at as string | null,
    team_id: s.team_id as string | null,
  }));

  // Resolve team_id → crew name
  const sessionTeamIds = [...new Set(sessions.map((s) => s.team_id).filter(Boolean))] as string[];
  const opsCrewIds = [...new Set(opsMovesData.map((m) => m.crew_id).filter(Boolean))] as string[];
  const allCrewIds = [...new Set([...sessionTeamIds, ...opsCrewIds, ...labourCrewIds])];

  const crewNamesMap: Record<string, string> = {};
  if (allCrewIds.length > 0) {
    const { data: crewRows } = await supabase
      .from("crews")
      .select("id, name")
      .in("id", allCrewIds);
    (crewRows || []).forEach((c) => {
      crewNamesMap[c.id as string] = (c.name as string) || "Unnamed Crew";
    });
  }

  return (
    <div className="w-full min-w-0 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Back" /></div>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Reports</h1>
        </div>
      </div>

      <ReportsClient
        eodReports={finalReports}
        eodKpis={{ reportCount: finalReports.length, totalJobs, teamCount }}
        initialDate={date}
        initialFrom={from}
        initialTo={to}
        initialTab={params.tab}
        crewFinancial={crewFinancial}
        opsMovesThisMonth={opsMovesData}
        trackingSessions={sessions}
        crewNames={crewNamesMap}
      />
    </div>
  );
}
