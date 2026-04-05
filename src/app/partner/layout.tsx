import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getPlatformToggles } from "@/lib/platform-settings";
import { PartnerOrgProvider } from "./PartnerOrgContext";
import PartnerLightTheme from "./PartnerLightTheme";

export const dynamic = "force-dynamic";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const toggles = await getPlatformToggles();

  const supabase = await createClient();
  let user: { id: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data?.user ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/refresh\s*token|AuthApiError/i.test(msg)) {
      await supabase.auth.signOut();
      redirect("/partner/login");
    }
    throw err;
  }

  if (!user) {
    return (
      <>
        <PartnerLightTheme />
        {children}
      </>
    );
  }

  if (!toggles.partner_portal) redirect("/portal-disabled");

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const hasPartnerAccess = partnerRows != null && partnerRows.length > 0;

  if (platformUser && !hasPartnerAccess) redirect("/admin");

  // Fetch org name in layout so header always shows correct name (admin client bypasses RLS)
  let orgDisplayName = "Partner";
  const primaryOrgId = partnerRows?.[0]?.org_id;
  if (primaryOrgId) {
    try {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("name, contact_name, email")
        .eq("id", primaryOrgId)
        .single();
      const fromEmail =
        org?.email?.trim() &&
        (() => {
          const part = org.email!.includes("@")
            ? org.email!.split("@")[1]?.replace(/\.[^.]*$/, "")
            : org.email!;
          return part
            ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
            : "";
        })();
      orgDisplayName =
        (org?.name || org?.contact_name || fromEmail || "Partner").trim() ||
        "Partner";
    } catch (_e) {
      // keep "Partner" if fetch fails
    }
  }

  return (
    <PartnerOrgProvider orgDisplayName={orgDisplayName}>
      <PartnerLightTheme />
      <div
        className="min-h-screen bg-[#FAF7F2]"
        suppressHydrationWarning
      >
        {children}
      </div>
    </PartnerOrgProvider>
  );
}
