import { createClient } from "@/lib/supabase/server";
import BackButton from "../components/BackButton";
import SettingsTabs from "./SettingsTabs";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = user
    ? await supabase.from("platform_users").select("role").eq("user_id", user.id).single()
    : { data: null };
  const { data: partnerUser } = user
    ? await supabase.from("partner_users").select("org_id").eq("user_id", user.id).single()
    : { data: null };
  const isSuperAdmin = (user?.email || "").toLowerCase() === (process.env.SUPER_ADMIN_EMAIL || "othaplug@gmail.com").toLowerCase();
  const isPartner = !!partnerUser && !platformUser && !isSuperAdmin;

  return (
    <div className="max-w-[720px] mx-auto px-5 md:px-6 py-6 md:py-8 space-y-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <SettingsTabs isPartner={isPartner} />
      {children}
    </div>
  );
}
