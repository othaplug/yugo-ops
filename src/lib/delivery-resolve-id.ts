import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/move-code";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolves a delivery row UUID from an API path segment: either a Postgres UUID
 * or a human-readable delivery_number (e.g. DLV-6982). Matches admin delivery detail URLs.
 */
export async function resolveDeliveryUuidFromApiPathSegment(
  admin: AdminClient,
  segment: string,
): Promise<string | null> {
  const s = decodeURIComponent(String(segment || "").trim());
  if (!s) return null;

  if (isUuid(s)) {
    const { data } = await admin.from("deliveries").select("id").eq("id", s).maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await admin.from("deliveries").select("id").ilike("delivery_number", s).maybeSingle();
  return data?.id ?? null;
}
