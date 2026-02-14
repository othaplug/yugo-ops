import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const supabase = await createClient();

  const [{ data: deliveries }, { data: moves }, { data: crews }] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date"),
    supabase.from("moves").select("*"),
    supabase.from("crews").select("*"),
  ]);

  return (
    <>
      <Topbar title="Crew Calendar" subtitle="Feb 2026" />
      <div className="max-w-[1200px] px-6 py-5">
        <CalendarView
          deliveries={deliveries || []}
          moves={moves || []}
          crews={crews || []}
        />
      </div>
    </>
  );
}