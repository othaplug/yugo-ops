import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SettingsHubNav from "./SettingsHubNav";
import SettingsBackToHub from "./SettingsBackToHub";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { PageHeader } from "@/design-system/admin/layout";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SettingsBackToHub />
        <PageHeader
          eyebrow="Workspace"
          title="Settings"
          description="Personal preferences, notifications, team and platform configuration. The overview lists every section; the sidebar appears on detail pages."
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 lg:gap-6 sm:items-start min-h-0">
        <SettingsHubNav
          isPartner={isPartner}
          showOperations={showOperations}
          showPlatform={showPlatform}
        />
        <div className="flex-1 min-w-0 min-h-0">{children}</div>
      </div>
    </div>
  );
}
