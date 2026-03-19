import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import SettingsTabs from "./SettingsTabs";
import { isSuperAdminEmail } from "@/lib/super-admin";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const db = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = user
    ? await db.from("platform_users").select("role").eq("user_id", user.id).single()
    : { data: null };
  const { data: partnerUser } = user
    ? await db.from("partner_users").select("org_id").eq("user_id", user.id).single()
    : { data: null };
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const isPartner = !!partnerUser && !platformUser && !isSuperAdmin;

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6 md:py-8 space-y-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <div>
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Admin</p>
        <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Settings</h1>
      </div>
      <SettingsTabs isPartner={isPartner} />
      {children}
    </div>
  );
}
