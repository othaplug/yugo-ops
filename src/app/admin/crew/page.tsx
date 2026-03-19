export const metadata = { title: "Crew & Dispatch" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
      {/* Floating header overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--card)]/90 backdrop-blur-sm border border-[var(--brd)] shadow-sm">
          <span className="text-[8px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60">Operations</span>
          <span className="w-px h-3 bg-[var(--brd)]" />
          <span className="text-[11px] font-bold text-[var(--tx)]">Live Crew Map</span>
        </div>
      </div>
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
