import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import UnifiedTrackingView from "./UnifiedTrackingView";

export default async function CrewPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: crews }, { data: deliveries }, { data: moves }] = await Promise.all([
    supabase.from("crews").select("id, name, members, current_lat, current_lng, status, updated_at, delay_minutes").order("name"),
    supabase.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address").order("scheduled_date"),
    supabase.from("moves").select("id, move_code, crew_id, scheduled_date, status, from_address, to_address").order("scheduled_date"),
  ]);

  const crewsForMap = (crews || []).map((c) => ({
    id: c.id,
    name: c.name,
    members: (c.members as string[]) || [],
    status: c.status || "standby",
    current_lat: c.current_lat,
    current_lng: c.current_lng,
    current_job: null,
    updated_at: c.updated_at,
    delay_minutes: c.delay_minutes,
  }));

  const todayMoves = (moves || []).filter((m) => m.scheduled_date === today && m.crew_id && !["completed", "cancelled"].includes((m.status || "").toLowerCase()));
  const todayDeliveries = (deliveries || []).filter((d) => d.scheduled_date === today && d.crew_id && !["delivered", "cancelled"].includes((d.status || "").toLowerCase()));

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <UnifiedTrackingView
        initialCrews={crewsForMap}
        initialDeliveries={deliveries || []}
        todayMoves={todayMoves}
        todayDeliveries={todayDeliveries}
      />
    </div>
  );
}