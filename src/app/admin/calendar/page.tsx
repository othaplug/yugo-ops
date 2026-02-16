import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: deliveries }, { data: moves }] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date"),
    supabase.from("moves").select("*"),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-5 md:py-6 animate-fade-up overflow-x-hidden">
      <div className="mb-4"><BackButton label="Back" /></div>
      <CalendarView
        deliveries={deliveries || []}
        moves={moves || []}
      />
    </div>
  );
}