import type { SupabaseClient } from "@supabase/supabase-js";
import { CREW_JOB_UUID_RE, normalizeCrewJobId, selectDeliveryByJobId } from "@/lib/resolve-delivery-by-job-id";

/** Resolved move or delivery row for crew inventory verify / list APIs. */
export type ResolvedCrewInventoryJob =
  | { kind: "move"; id: string; crew_id: string }
  | { kind: "delivery"; id: string; crew_id: string };

/**
 * Resolve job id from URL (UUID or short code) to a move or delivery the crew can access.
 */
export async function resolveCrewInventoryJob(
  admin: SupabaseClient,
  rawJobId: string
): Promise<ResolvedCrewInventoryJob | null> {
  const jobId = normalizeCrewJobId(rawJobId);
  if (!jobId) return null;

  if (CREW_JOB_UUID_RE.test(jobId)) {
    const { data: move } = await admin.from("moves").select("id, crew_id").eq("id", jobId).maybeSingle();
    if (move?.id && move.crew_id != null) {
      return { kind: "move", id: move.id, crew_id: String(move.crew_id) };
    }
    const { data: d } = await selectDeliveryByJobId(admin, jobId, "id, crew_id");
    if (d?.id != null && d.crew_id != null) {
      return { kind: "delivery", id: String(d.id), crew_id: String(d.crew_id) };
    }
    return null;
  }

  const { data: move } = await admin
    .from("moves")
    .select("id, crew_id")
    .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
    .maybeSingle();
  if (move?.id && move.crew_id != null) {
    return { kind: "move", id: move.id, crew_id: String(move.crew_id) };
  }

  const { data: d } = await selectDeliveryByJobId(admin, jobId, "id, crew_id");
  if (d?.id != null && d.crew_id != null) {
    return { kind: "delivery", id: String(d.id), crew_id: String(d.crew_id) };
  }
  return null;
}
