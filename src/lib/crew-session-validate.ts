import { createAdminClient } from "@/lib/supabase/admin";
import type { CrewTokenPayload } from "@/lib/crew-token";

/** Ensure JWT still matches the crew member row (team moves, deactivation). */
export async function crewMemberMatchesSessionToken(payload: CrewTokenPayload): Promise<boolean> {
  const admin = createAdminClient();
  const { data: cm } = await admin
    .from("crew_members")
    .select("team_id, is_active")
    .eq("id", payload.crewMemberId)
    .maybeSingle();
  if (!cm?.is_active) return false;
  return cm.team_id === payload.teamId;
}
