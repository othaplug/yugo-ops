import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMaxHubSpotJobNo } from "@/lib/hubspot/max-job-no";

const QUOTE_ID_NUMERIC_MAX = 999_999;
/** First numeric suffix when no quotes / HubSpot job numbers exist yet (4-digit scale). */
export const QUOTE_ID_NUMERIC_MIN = 3001;

export async function getQuoteIdPrefix(sb: SupabaseClient): Promise<string> {
  const { data: prefixRow } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", "quote_id_prefix")
    .maybeSingle();
  return (prefixRow?.value || "YG-").trim() || "YG-";
}

/**
 * Numeric part of quote_id for HubSpot job_no (no prefix), or null if not a plain numeric suffix.
 */
export function quoteNumericSuffixForHubSpot(quoteId: string, prefix: string): string | null {
  if (!quoteId.startsWith(prefix)) return null;
  const num = quoteId.slice(prefix.length);
  if (!/^\d+$/.test(num)) return null;
  return num;
}

async function maxNumericSuffixFromQuotesDb(sb: SupabaseClient, prefix: string): Promise<number> {
  const { data, error } = await sb.rpc("max_quote_numeric_suffix", { quote_prefix: prefix });
  if (!error && typeof data === "number" && !Number.isNaN(data)) {
    return data;
  }

  // Fallback if RPC missing (local without migration): scan matching rows (capped).
  const likePattern = prefix.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";
  const { data: rows } = await sb.from("quotes").select("quote_id").like("quote_id", likePattern).limit(50_000);

  let max = 0;
  for (const row of rows ?? []) {
    const id = row.quote_id || "";
    const numPart = id.startsWith(prefix) ? id.slice(prefix.length) : id;
    if (!/^\d+$/.test(numPart)) continue;
    const n = parseInt(numPart, 10);
    if (!Number.isNaN(n) && n <= QUOTE_ID_NUMERIC_MAX && n > max) max = n;
  }
  return max;
}

export type GenerateNextQuoteIdOptions = {
  /** When set, next id is above max(existing quotes, HubSpot job_no). */
  hubspotAccessToken?: string | null;
};

/**
 * Next quote_id using platform_config.quote_id_prefix (default YG-).
 * Numeric suffix is max(OPS quotes, HubSpot job_no, floor) + 1, with floor {@link QUOTE_ID_NUMERIC_MIN}.
 */
export async function generateNextQuoteId(
  sb: SupabaseClient,
  options?: GenerateNextQuoteIdOptions,
): Promise<string> {
  const prefix = await getQuoteIdPrefix(sb);
  const maxOps = await maxNumericSuffixFromQuotesDb(sb, prefix);

  let maxHs = 0;
  const token = options?.hubspotAccessToken;
  if (token) {
    try {
      maxHs = await fetchMaxHubSpotJobNo(token);
    } catch (e) {
      console.warn("[quote-id] HubSpot max job_no fetch failed:", e);
    }
  }

  const next = Math.max(maxOps, maxHs, QUOTE_ID_NUMERIC_MIN - 1) + 1;
  if (next > QUOTE_ID_NUMERIC_MAX) {
    throw new Error("Quote id numeric suffix overflow");
  }
  return `${prefix}${next}`;
}

/** Postgres unique violation (quote_id). */
export function isQuoteIdUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = (err.message || "").toLowerCase();
  return m.includes("duplicate") || m.includes("unique constraint") || m.includes("quotes_quote_id");
}
