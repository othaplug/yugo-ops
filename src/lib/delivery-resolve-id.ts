import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeDeliveryNumber } from "@/lib/delivery-number";
import { isUuid } from "@/lib/move-code";

type AdminClient = ReturnType<typeof createAdminClient>;

/** 32-char hex without hyphens -> standard UUID string for PostgREST eq("id", …). */
function normalizeUuidSegment(raw: string): string {
  const compact = raw.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  }
  return raw;
}

function stripUuidBraces(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && t.startsWith("{") && t.endsWith("}")) return t.slice(1, -1).trim();
  return raw;
}

/**
 * Resolves a delivery row UUID from an API path segment: either a Postgres UUID
 * or a human-readable delivery_number (e.g. DLV-6982). Matches admin delivery detail URLs.
 */
export async function resolveDeliveryUuidFromApiPathSegment(
  admin: AdminClient,
  segment: string,
): Promise<string | null> {
  let s = stripUuidBraces(decodeURIComponent(String(segment || "").trim()).replace(/^#/, ""));
  if (!s) return null;

  const uuidCandidate = normalizeUuidSegment(s);
  if (isUuid(uuidCandidate)) {
    const { data } = await admin.from("deliveries").select("id").eq("id", uuidCandidate).maybeSingle();
    return data?.id ?? null;
  }

  const { data: byIlike } = await admin.from("deliveries").select("id").ilike("delivery_number", s).maybeSingle();
  if (byIlike?.id) return byIlike.id;

  const norm = normalizeDeliveryNumber(s);
  if (norm !== "DLV-0000") {
    const { data: byEq } = await admin.from("deliveries").select("id").eq("delivery_number", norm).maybeSingle();
    if (byEq?.id) return byEq.id;
  }

  return null;
}
