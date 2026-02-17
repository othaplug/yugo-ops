import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export type AuthRole = "admin" | "partner" | "client" | null;

export async function getAuthRole(user: User | null): Promise<AuthRole> {
  if (!user?.email) return null;

  const supabase = await createClient();
  const email = user.email.trim().toLowerCase();

  // 1. platform_users: role is the single source of truth for access
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (platformUser) {
    if (platformUser.role === "client") return "client";
    if (["admin", "manager", "dispatcher"].includes(platformUser.role || "")) return "admin";
  }

  // 2. No platform_users or not staff: check if they are a client (move client only)
  const { data: move } = await supabase
    .from("moves")
    .select("id")
    .ilike("client_email", email)
    .limit(1)
    .maybeSingle();
  if (move) return "client";

  // 3. Partner
  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("user_id")
    .eq("user_id", user.id)
    .single();
  if (partnerUser) return "partner";

  return null;
}
