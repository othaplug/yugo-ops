import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: deliveries }, { data: moves }, { data: crews }] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date"),
    supabase.from("moves").select("*"),
    supabase.from("crews").select("*"),
  ]);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5">
      <div className="mb-4"><BackButton label="Back" /></div>
      <CalendarView
        deliveries={deliveries || []}
        moves={moves || []}
        crews={crews || []}
      />
    </div>
  );
}