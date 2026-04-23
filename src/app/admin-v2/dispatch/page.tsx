import { createAdminClient } from "@/lib/supabase/admin"
import { getTodayString } from "@/lib/business-timezone"
import { getOfficeLocation } from "@/lib/platform-settings"
import { DispatchTracking } from "./dispatch-tracking"

export const metadata = { title: "Live tracking" }
export const dynamic = "force-dynamic"
export const revalidate = 0

const DispatchPage = async () => {
  const db = createAdminClient()
  const today = getTodayString()

  const [{ data: crews }, { data: deliveries }, { data: moves }, office] =
    await Promise.all([
      db
        .from("crews")
        .select(
          "id, name, members, current_lat, current_lng, status, updated_at, delay_minutes",
        )
        .order("name"),
      db
        .from("deliveries")
        .select(
          "id, delivery_number, crew_id, scheduled_date, status, delivery_address, pickup_address, pickup_lat, pickup_lng, delivery_lat, delivery_lng",
        )
        .order("created_at", { ascending: false }),
      db
        .from("moves")
        .select(
          "id, move_code, crew_id, client_name, scheduled_date, status, from_address, to_address, from_lat, from_lng, to_lat, to_lng",
        )
        .order("created_at", { ascending: false }),
      getOfficeLocation(),
    ])

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
  }))

  const todayMoves = (moves || []).filter(
    (m) =>
      m.scheduled_date === today &&
      m.crew_id &&
      !["completed", "cancelled"].includes((m.status || "").toLowerCase()),
  )
  const todayDeliveries = (deliveries || []).filter(
    (d) =>
      d.scheduled_date === today &&
      d.crew_id &&
      !["delivered", "cancelled"].includes((d.status || "").toLowerCase()),
  )

  return (
    <div className="-mx-4 -my-5 md:-mx-8 md:-my-6 relative h-[calc(100dvh-64px)] min-h-[520px] w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] overflow-hidden">
      <DispatchTracking
        initialCrews={crewsForMap}
        initialDeliveries={deliveries || []}
        todayMoves={todayMoves}
        todayDeliveries={todayDeliveries}
        routeMoves={moves || []}
        routeDeliveries={deliveries || []}
        office={office}
      />
    </div>
  )
}

export default DispatchPage
