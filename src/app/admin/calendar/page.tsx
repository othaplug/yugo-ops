export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString, getAppTimezone } from "@/lib/business-timezone";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const db = createAdminClient();
  const today = getTodayString();
  const appTimezone = getAppTimezone();

  const [{ data: deliveries }, { data: moves }, { data: projectPhases }] = await Promise.all([
    db.from("deliveries").select("*").order("scheduled_date"),
    db.from("moves").select("*"),
    db.from("project_phases")
      .select("id, project_id, phase_name, phase_order, status, scheduled_date, projects!inner(project_number, start_date)")
      .not("status", "eq", "skipped")
      .order("scheduled_date"),
  ]);

  const normalizedPhases = (projectPhases || []).map((p: any) => ({
    ...p,
    project_number: p.projects?.project_number || "PRJ",
    start_date: p.projects?.start_date || p.scheduled_date,
  }));

  return (
    <div className="animate-fade-up min-h-0">
      <CalendarView
        deliveries={deliveries || []}
        moves={moves || []}
        projectPhases={normalizedPhases}
        today={today}
        appTimezone={appTimezone}
      />
    </div>
  );
}
