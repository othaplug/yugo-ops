import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import ReportsClient from "./ReportsClient";
import { formatJobId } from "@/lib/move-code";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const from = params.from || params.date || today;
  const to = params.to || params.date || today;
  const date = params.date || from;

  const supabase = createAdminClient();
  let query = supabase
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
    query = query.gte("report_date", from).lte("report_date", to);
  } else {
    query = query.eq("report_date", date);
  }

  const { data: rawReports } = await query.order("report_date", { ascending: false }).order("generated_at", { ascending: false });

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
    const entry = { displayId: formatJobId(m.move_code || m.id, "move"), clientName: m.client_name || "—" };
    movesMap.set(m.id, entry);
    if (m.move_code) movesMap.set(String(m.move_code).trim().toUpperCase().replace(/^#/, ""), entry);
  });
  const deliveriesMap = new Map<string, { displayId: string; clientName: string }>();
  (deliveriesRes.data || []).forEach((d) => {
    const entry = { displayId: formatJobId(d.delivery_number || d.id, "delivery"), clientName: [d.customer_name, d.client_name].filter(Boolean).join(" — ") || "—" };
    deliveriesMap.set(d.id, entry);
    if (d.delivery_number) deliveriesMap.set(String(d.delivery_number).trim(), entry);
  });

  const reportsEnriched = reports.map((r) => {
    const jobs = ((r.jobs as { jobId: string; type: string; sessionId?: string; duration: number; signOff?: boolean; rating?: number | null }[]) || []).map((j) => {
      const map = j.type === "move" ? movesMap : deliveriesMap;
      const meta = map.get(j.jobId) ?? map.get(j.jobId.toUpperCase().replace(/^#/, "").trim());
      const hasDamage = damageJobKeys.has(`${j.jobId}:${j.type}`);
      return { ...j, displayId: meta?.displayId ?? formatJobId(j.jobId, j.type as "move" | "delivery"), clientName: meta?.clientName ?? "—", hasDamage };
    });
    return { ...r, jobs };
  });

  return (
    <div className="max-w-[1000px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <ReportsClient initialReports={reportsEnriched} initialDate={date} initialFrom={from} initialTo={to} />
    </div>
  );
}
