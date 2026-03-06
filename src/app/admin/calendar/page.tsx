export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString, getAppTimezone } from "@/lib/business-timezone";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const db = createAdminClient();
  const today = getTodayString();
  const appTimezone = getAppTimezone();

  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    db.from("deliveries").select("*").order("scheduled_date"),
    db.from("moves").select("*"),
  ]);

  return (
    <div className="animate-fade-up min-h-0">
      <CalendarView
        deliveries={deliveries || []}
        moves={moves || []}
        today={today}
        appTimezone={appTimezone}
      />
    </div>
  );
}
