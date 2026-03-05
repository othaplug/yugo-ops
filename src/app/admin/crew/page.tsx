import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import { getOfficeLocation } from "@/lib/platform-settings";
import UnifiedTrackingView from "./UnifiedTrackingView";

export default async function CrewPage() {
  const db = createAdminClient();
  const today = getTodayString();
  const [{ data: crews }, { data: deliveries }, { data: moves }, office] = await Promise.all([
    db.from("crews").select("id, name, members, current_lat, current_lng, status, updated_at, delay_minutes").order("name"),
    db.from("deliveries").select("id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address").order("scheduled_date"),
    db.from("moves").select("id, move_code, crew_id, client_name, scheduled_date, status, from_address, to_address").order("scheduled_date"),
    getOfficeLocation(),
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
    <div className="relative w-full h-full min-h-[500px]" style={{ height: "calc(100dvh - 3.5rem)" }}>
      <UnifiedTrackingView
        initialCrews={crewsForMap}
        initialDeliveries={deliveries || []}
        todayMoves={todayMoves}
        todayDeliveries={todayDeliveries}
        office={office}
      />
    </div>
  );
}
