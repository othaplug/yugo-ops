import { createClient } from "@/lib/supabase/server";
import AllProjectsView from "./AllProjectsView";

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*").order("scheduled_date", { ascending: true }),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <AllProjectsView deliveries={allDeliveries} moves={allMoves} today={today} />
    </div>
  );
}