import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminShell from "./components/AdminShell";
import ChangePasswordGate from "./components/ChangePasswordGate";
import TwoFAGate from "./components/TwoFAGate";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ChangePasswordGate>
      <TwoFAGate>
        <AdminShell user={user}>{children}</AdminShell>
      </TwoFAGate>
    </ChangePasswordGate>
  );
}