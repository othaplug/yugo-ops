import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const date = params.date || new Date().toISOString().split("T")[0];

  const supabase = await createClient();
  const { data: rawReports } = await supabase
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
    `)
    .eq("report_date", date)
    .order("generated_at", { ascending: false });

  const reports = (rawReports || []).map((r) => {
    const crews = r.crews as { name?: string }[] | { name?: string } | null | undefined;
    const crew = Array.isArray(crews) ? crews[0] : crews;
    return { ...r, crews: crew ? { name: crew.name ?? "Team" } : null };
  });

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <ReportsClient initialReports={reports} initialDate={date} />
    </div>
  );
}
