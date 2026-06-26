import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { isSuperAdminEmail } from "@/lib/super-admin";

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function requireAdmin() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, admin: null, error };
  const superAdmin = isSuperAdminEmail(user!.email);
  if (superAdmin) {
    return { user, admin: { isSuperAdmin: true, role: "owner" }, error: null };
  }
  const db = createAdminClient();
  const { data: platformUser } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isAdmin = platformUser?.role === "admin" || platformUser?.role === "manager" || platformUser?.role === "owner";
  if (!isAdmin) {
    return { user, admin: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, admin: { isSuperAdmin: false, role: platformUser?.role }, error: null };
}

/** Admin, manager, dispatcher, or superadmin — for staff actions like sending tracking links */
export async function requireStaff() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  if (isSuperAdminEmail(user!.email)) {
    return { user, error: null };
  }
  const db = createAdminClient();
  const { data: platformUser } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isStaff = ["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales"].includes(platformUser?.role || "");
  if (!isStaff) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, error: null };
}

export { isSuperAdminEmail } from "@/lib/super-admin";

/**
 * Non-throwing check: is the current request authenticated as Yugo staff?
 *
 * Returns `true` for any logged-in user whose `platform_users.role` puts
 * them on staff (owner / admin / manager / dispatcher / coordinator /
 * viewer / sales) or who's a super-admin by email. Returns `false`
 * otherwise — including for unauthenticated visitors. NEVER throws and
 * NEVER returns a NextResponse, so it's safe to call from public routes
 * that need to fork behavior based on caller identity (e.g. an event-
 * tracking endpoint that should drop admin pings).
 *
 * Built 2026-06-25 after Oche flagged that admin opens of /quote/[id]
 * were getting recorded as customer views in quote_engagement_events.
 */
export async function isStaffSession(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    if (isSuperAdminEmail(user.email)) return true;
    const db = createAdminClient();
    const { data: platformUser } = await db
      .from("platform_users")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    return ["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales"].includes(
      platformUser?.role || "",
    );
  } catch {
    return false;
  }
}

/**
 * Use before sending any sensitive email (invite, password reset, portal welcome).
 * Prevents an admin from sending credentials or links to their own email (account hijack protection).
 */
export function isRecipientSameAsAdmin(
  adminUser: { email?: string | null } | null,
  recipientEmail: string | null | undefined
): boolean {
  const a = (adminUser?.email ?? "").trim().toLowerCase();
  const r = (recipientEmail ?? "").trim().toLowerCase();
  return a.length > 0 && r.length > 0 && a === r;
}
