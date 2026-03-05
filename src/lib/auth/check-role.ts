import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/super-admin";

export type AppRole = "owner" | "admin" | "manager" | "dispatcher" | "coordinator" | "viewer" | "crew" | "partner" | "client";

const ROLE_LEVEL: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  dispatcher: 50,
  coordinator: 40,
  viewer: 30,
  crew: 20,
  partner: 10,
  client: 5,
};

export function roleLevel(role: string | null | undefined): number {
  return ROLE_LEVEL[role ?? ""] ?? 0;
}

export function hasMinRole(userRole: string | null | undefined, required: AppRole): boolean {
  return roleLevel(userRole) >= roleLevel(required);
}

/**
 * Server-side role check for API routes.
 * Super admin emails always get "owner" access regardless of platform_users entry.
 * Uses admin client for platform_users lookup to bypass RLS.
 * Returns `{ user, role, error }`. If error is set, return it as the response.
 */
export async function requireRole(minRole: AppRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      role: null as string | null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (isSuperAdminEmail(user.email)) {
    return { user, role: "owner" as string, error: null };
  }

  const db = createAdminClient();
  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const userRole = pu?.role ?? "viewer";

  if (!hasMinRole(userRole, minRole)) {
    return {
      user,
      role: userRole,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, role: userRole, error: null };
}

/**
 * Owner-only shortcut for pricing and config routes.
 */
export async function requireOwner() {
  return requireRole("owner");
}
