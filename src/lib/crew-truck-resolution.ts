import type { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Resolve fleet vehicle id for crew equipment / tracking.
 * 1) Active registered device for this team with a truck_id (iPad setup).
 * 2) Else today's truck_assignment for this team (dispatch board).
 */
export async function getTruckIdForCrewTeam(admin: Admin, teamId: string): Promise<string | null> {
  const { data: device } = await admin
    .from("registered_devices")
    .select("truck_id")
    .eq("default_team_id", teamId)
    .eq("is_active", true)
    .not("truck_id", "is", null)
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (device?.truck_id) return device.truck_id as string;

  const today = getTodayString();
  const { data: assign } = await admin
    .from("truck_assignments")
    .select("truck_id")
    .eq("team_id", teamId)
    .eq("date", today)
    .maybeSingle();

  return (assign?.truck_id as string) || null;
}
