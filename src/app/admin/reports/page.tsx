export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import BackButton from "../components/BackButton";
import ReportsClient from "./ReportsClient";
import { formatJobId, getMoveCode } from "@/lib/move-code";

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
    { data: financialMoves },
    { data: financialDeliveries },
    { data: invoiceSummary },
    { data: opsMoves },
    { data: trackingSessions },
  ] = await Promise.all([
    eodQuery.order("report_date", { ascending: false }).order("generated_at", { ascending: false }),

    supabase
      .from("moves")
      .select("id, service_type, estimate, status, scheduled_date, crew_id, created_at")
      .gte("scheduled_date", sixAgo)
      .not("estimate", "is", null),

    supabase
      .from("deliveries")
      .select("id, total_price, status, scheduled_date, created_at")
      .gte("scheduled_date", sixAgo)
      .not("total_price", "is", null),

    supabase
      .from("invoices")
      .select("id, amount, status, created_at")
      .gte("created_at", sixAgo),

    supabase
      .from("moves")
      .select("id, status, scheduled_date, crew_id, completed_at")
      .gte("scheduled_date", monthStart),

    supabase
      .from("tracking_sessions")
      .select("id, job_id, job_type, status, started_at, completed_at, team_id")
      .gte("started_at", monthStart),
  ]);

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

  const totalJobs = reportsEnriched.reduce((s, r) => s + ((r.jobs as unknown[]) || []).length, 0);
  const teamCount = new Set(reportsEnriched.map((r) => r.team_id)).size;

  /* ── Financial data ── */
  const moveFinancials = (financialMoves || []).map((m) => ({
    id: m.id as string,
    service_type: (m.service_type as string) || "other",
    estimate: Number(m.estimate) || 0,
    status: m.status as string,
    scheduled_date: m.scheduled_date as string,
  }));

  const deliveryFinancials = (financialDeliveries || []).map((d) => ({
    id: d.id as string,
    total_price: Number(d.total_price) || 0,
    status: d.status as string,
    scheduled_date: d.scheduled_date as string,
  }));

  const invoices = (invoiceSummary || []).map((inv) => ({
    id: inv.id as string,
    amount: Number(inv.amount) || 0,
    status: inv.status as string,
  }));

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
  const allCrewIds = [...new Set([...sessionTeamIds, ...opsCrewIds])];

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
    <div className="max-w-[1100px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Back" /></div>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Operations</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Reports</h1>
        </div>
      </div>

      <ReportsClient
        eodReports={reportsEnriched}
        eodKpis={{ reportCount: reportsEnriched.length, totalJobs, teamCount }}
        initialDate={date}
        initialFrom={from}
        initialTo={to}
        initialTab={params.tab}
        financialMoves={moveFinancials}
        financialDeliveries={deliveryFinancials}
        invoices={invoices}
        opsMovesThisMonth={opsMovesData}
        trackingSessions={sessions}
        crewNames={crewNamesMap}
      />
    </div>
  );
}
