import type { SupabaseClient } from "@supabase/supabase-js";

const QUOTE_ID_NUMERIC_MAX = 999_999;

/** Next sequential quote_id using platform_config.quote_id_prefix (default YG-). */
export async function generateNextQuoteId(sb: SupabaseClient): Promise<string> {
  const { data: prefixRow } = await sb
    .from("platform_config")
    .select("value")
    .eq("key", "quote_id_prefix")
    .maybeSingle();
  const prefix = (prefixRow?.value || "YG-").trim() || "YG-";
  const likePattern = prefix.replace(/%/g, "\\%").replace(/_/g, "\\_") + "%";

  const { data } = await sb
    .from("quotes")
    .select("quote_id")
    .like("quote_id", likePattern)
    .order("created_at", { ascending: false })
    .limit(100);

  let next = 30001;
  if (data && data.length > 0) {
    const nums = data
      .map((row) => {
        const id = row.quote_id || "";
        const numPart = id.startsWith(prefix) ? id.slice(prefix.length) : id;
        return parseInt(numPart, 10);
      })
      .filter((n) => !isNaN(n) && n <= QUOTE_ID_NUMERIC_MAX);
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    if (max >= 30001) next = max + 1;
  }
  return `${prefix}${next}`;
}
