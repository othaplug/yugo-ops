import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

export async function getCoordinatorDisplay(
  db: Db,
  opts: { assignedTo: string | null; fallbackUserId: string },
): Promise<{ name: string; phone: string }> {
  const id = (opts.assignedTo || opts.fallbackUserId).trim();
  const { data: pu } = await db
    .from("platform_users")
    .select("name, phone, email")
    .eq("user_id", id)
    .maybeSingle();
  const name = (pu?.name && String(pu.name).trim()) || "Your Yugo coordinator";
  const phone = (pu?.phone && String(pu.phone).trim()) || "";
  if (phone) return { name, phone };
  const fallback = (process.env.NEXT_PUBLIC_YUGO_PHONE || "").trim();
  return { name, phone: fallback };
}
