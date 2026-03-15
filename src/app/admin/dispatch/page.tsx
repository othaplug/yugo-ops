export const metadata = { title: "Dispatch" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import DispatchBoardClient from "./DispatchBoardClient";

export default async function DispatchPage() {
  const db = createAdminClient();
  const today = getTodayString();

  const [
    { data: moves },
    { data: deliveries },
    { data: crews },
  ] = await Promise.all([
    db.from("moves")
      .select("id, move_code, crew_id, client_name, from_address, to_address, scheduled_date, preferred_time, status")
      .eq("scheduled_date", today)
      .not("status", "in", '("completed","cancelled")')
      .order("preferred_time", { ascending: true, nullsFirst: false }),
    db.from("deliveries")
      .select("id, delivery_number, crew_id, client_name, customer_name, delivery_address, scheduled_date, time_slot, status")
      .eq("scheduled_date", today)
      .not("status", "in", '("delivered","completed","cancelled")')
      .order("time_slot", { ascending: true, nullsFirst: false }),
    db.from("crews")
      .select("id, name, members, status, current_lat, current_lng, delay_minutes")
      .order("name"),
  ]);

  const crewsForBoard = (crews || []).map((c) => ({
    id: c.id,
    name: c.name,
    members: (Array.isArray(c.members) ? c.members : []).map((m: unknown) => {
      if (typeof m === "string") return m.trim();
      if (m && typeof m === "object" && "name" in m) return String((m as { name?: unknown }).name ?? "").trim();
      return String(m ?? "").trim();
    }).filter(Boolean),
    status: c.status || "standby",
    current_lat: c.current_lat,
    current_lng: c.current_lng,
    delay_minutes: c.delay_minutes,
  }));

  return (
    <DispatchBoardClient
      today={today}
      initialCrews={crewsForBoard}
      initialMoves={moves || []}
      initialDeliveries={deliveries || []}
    />
  );
}
