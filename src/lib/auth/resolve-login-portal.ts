import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isSuperAdminEmail } from "@/lib/super-admin";

/** Mirrors logic in GET /api/auth/role — runs in the browser with the user session (no extra HTTP hop). */
export type LoginPortal = "client" | "partner" | "admin";

const STAFF_ROLES = ["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales"] as const;

export async function resolveLoginPortal(supabase: SupabaseClient, user: User): Promise<LoginPortal> {
  if (isSuperAdminEmail(user.email)) return "admin";

  const email = (user.email || "").trim().toLowerCase();

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (platformUser?.role) {
    const role = platformUser.role;
    if (role === "client") return "client";
    if (STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) return "admin";
  }

  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1);
  if (partnerRows && partnerRows.length > 0) return "partner";

  const { data: move } = await supabase
    .from("moves")
    .select("id")
    .ilike("client_email", email)
    .limit(1)
    .maybeSingle();
  if (move) return "client";

  return "admin";
}
