import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/** Same pattern as crew job API: UUID = primary key first, then delivery_number (covers UUID-shaped numbers). */
export const CREW_JOB_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeCrewJobId(raw: unknown): string {
  if (raw == null) return "";
  return typeof raw === "string" ? raw.trim() : String(raw).trim();
}

export type DeliveryByJobIdResult = {
  data: Record<string, unknown> | null;
  error: PostgrestError | null;
};

/**
 * Resolve a delivery row by URL/API job id (UUID or short code / UUID-shaped delivery_number).
 * Uses maybeSingle() throughout (same as crew GET).
 */
export async function selectDeliveryByJobId(
  admin: SupabaseClient,
  rawJobId: unknown,
  select: string
): Promise<DeliveryByJobIdResult> {
  const jobId = normalizeCrewJobId(rawJobId);
  if (!jobId) return { data: null, error: null };

  const isUuid = CREW_JOB_UUID_RE.test(jobId);
  if (isUuid) {
    const byId = await admin.from("deliveries").select(select).eq("id", jobId).maybeSingle();
    if (byId.data) {
      return { data: byId.data as unknown as Record<string, unknown>, error: byId.error };
    }
    const byNum = await admin.from("deliveries").select(select).ilike("delivery_number", jobId).maybeSingle();
    return {
      data: (byNum.data as unknown as Record<string, unknown> | null) ?? null,
      error: byNum.error,
    };
  }
  const res = await admin.from("deliveries").select(select).ilike("delivery_number", jobId).maybeSingle();
  return { data: (res.data as unknown as Record<string, unknown> | null) ?? null, error: res.error };
}
