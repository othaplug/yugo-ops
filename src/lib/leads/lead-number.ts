import type { SupabaseClient } from "@supabase/supabase-js";

/** Next lead number as LD-0001 (4+ digits once past 9999). */
export async function generateLeadNumber(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb
    .from("leads")
    .select("lead_number")
    .like("lead_number", "LD-%")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[leads] generateLeadNumber query:", error.message);
    return `LD-${Date.now().toString().slice(-6)}`;
  }

  let max = 0;
  for (const row of data || []) {
    const raw = String((row as { lead_number?: string }).lead_number || "");
    const m = /^LD-(\d+)$/i.exec(raw.trim());
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }

  const next = max + 1;
  const width = next <= 9999 ? 4 : String(next).length;
  return `LD-${String(next).padStart(width, "0")}`;
}
