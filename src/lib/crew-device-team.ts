import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";

/**
 * Resolve which crew (team) a registered tablet is bound to: today's truck assignment
 * overrides default_team_id. Uses the same "today" as the crew dashboard (business timezone).
 */
export async function resolveRegisteredDeviceTeamId(deviceId: string) {
  const trimmed = deviceId.trim().slice(0, 128);
  if (!trimmed) return null;

  const admin = createAdminClient();
  const { data: device, error } = await admin
    .from("registered_devices")
    .select("id, truck_id, default_team_id, device_name")
    .eq("device_id", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !device) return null;

  let teamId = device.default_team_id;

  const today = getTodayString();
  if (device.truck_id) {
    const { data: assignment } = await admin
      .from("truck_assignments")
      .select("team_id")
      .eq("truck_id", device.truck_id)
      .eq("date", today)
      .maybeSingle();
    if (assignment?.team_id) teamId = assignment.team_id;
  }

  return { device, teamId: teamId || null };
}
