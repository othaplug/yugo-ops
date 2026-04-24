import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import SettingsHubNav from "./SettingsHubNav";
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

  // PR 2 role gates: anyone with a platform_users row sees Operations;
  // owner / super-admin sees Platform. Partners see Workspace only.
  const role = platformUser?.role ?? "";
  const showOperations = !isPartner && Boolean(platformUser);
  const showPlatform = isSuperAdmin || role === "owner";

  return (
    <div className="w-full max-w-[min(100vw-1.25rem,1580px)] 2xl:max-w-[1700px] min-w-0 mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-6 md:py-8 animate-fade-up">
      <div className="mb-4">
        <BackButton label="Back" />
      </div>
      <div className="mb-8">
        <p className="t-label text-[var(--color-text-tertiary)] mb-1.5">Account</p>
        <h1 className="admin-page-hero text-[var(--tx)]">Settings</h1>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-5 sm:items-start min-h-0">
        <SettingsHubNav
          isPartner={isPartner}
          showOperations={showOperations}
          showPlatform={showPlatform}
        />
        <div className="flex-1 min-w-0 space-y-6 sm:pl-1">{children}</div>
      </div>
    </div>
  );
}
