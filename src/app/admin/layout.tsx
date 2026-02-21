import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminShell from "./components/AdminShell";
import ChangePasswordGate from "./components/ChangePasswordGate";
import TwoFAGate from "./components/TwoFAGate";

import { getSuperAdminEmail } from "@/lib/super-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let role = "dispatcher";
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (platformUser?.role) role = platformUser.role;

  const isSuperAdmin = (user.email || "").toLowerCase() === getSuperAdminEmail();
  const isAdmin = isSuperAdmin || role === "admin" || role === "manager";

  return (
    <ChangePasswordGate>
      <TwoFAGate>
        <AdminShell user={user} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} role={role}>
          {children}
        </AdminShell>
      </TwoFAGate>
    </ChangePasswordGate>
  );
}