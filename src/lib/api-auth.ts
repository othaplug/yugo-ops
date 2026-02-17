import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "othaplug@gmail.com";

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
  const isSuperAdmin = (user!.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const supabase = await createClient();
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isAdmin = isSuperAdmin || platformUser?.role === "admin" || platformUser?.role === "manager";
  if (!isAdmin) {
    return { user, admin: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, admin: { isSuperAdmin, role: platformUser?.role }, error: null };
}

/** Admin, manager, dispatcher, or superadmin — for staff actions like sending tracking links */
export async function requireStaff() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, error };
  const isSuperAdmin = (user!.email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const supabase = await createClient();
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user!.id)
    .single();
  const isStaff = isSuperAdmin || ["admin", "manager", "dispatcher"].includes(platformUser?.role || "");
  if (!isStaff) {
    return { user: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, error: null };
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return (email || "").toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
