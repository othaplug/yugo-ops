import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminShellV3Wrapper from "./components/AdminShellV3Wrapper";
import ChangePasswordGate from "./components/ChangePasswordGate";
import TwoFAGate from "./components/TwoFAGate";

import { isSuperAdminEmail } from "@/lib/super-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  let user: { id: string; email?: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data?.user ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/refresh\s*token|AuthApiError/i.test(msg)) {
      await supabase.auth.signOut();
      redirect("/login");
    }
    throw err;
  }

  if (!user) {
    redirect("/login");
  }

  // User-scoped client only — avoids throwing when SUPABASE_SERVICE_ROLE_KEY is missing (layout errors
  // are not caught by admin/error.tsx and surface as a generic 500). RLS allows authenticated SELECT on platform_users.
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role, two_factor_enabled")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin = isSuperAdminEmail(user.email);

  if (!platformUser && !isSuperAdmin) {
    redirect("/partner");
  }

  let role = platformUser?.role || "dispatcher";
  if (isSuperAdmin) role = "owner";
  const isAdmin = isSuperAdmin || role === "admin" || role === "manager" || role === "owner";
  const twoFactorEnabled = !!platformUser?.two_factor_enabled;

  return (
    <ChangePasswordGate>
      <TwoFAGate>
        <AdminShellV3Wrapper user={user} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} role={role} twoFactorEnabled={twoFactorEnabled}>
          {children}
        </AdminShellV3Wrapper>
      </TwoFAGate>
    </ChangePasswordGate>
  );
}