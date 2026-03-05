import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import AllProjectsView from "./AllProjectsView";

export default async function DeliveriesPage() {
  const db = createAdminClient();
  const today = getTodayString();
  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    db.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    db.from("moves").select("*").order("scheduled_date", { ascending: true }),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];

  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <AllProjectsView deliveries={allDeliveries} moves={allMoves} today={today} />
    </div>
  );
}