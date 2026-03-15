import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PartnerPortalClient from "./PartnerPortalClient";

// Always fetch fresh org so header shows current name (e.g. after Edit Partner saves "Avenue Road")
export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: partnerRows, error: partnerError } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (partnerError) {
    console.error("Partner page partner_users error", partnerError);
    redirect(`/partner/login?error=partner_lookup&message=${encodeURIComponent(partnerError.message)}`);
  }

  const primaryOrgId = partnerRows?.[0]?.org_id;
  if (!primaryOrgId) redirect("/partner/login?error=no_org");

  // Use admin client so we always get org details (e.g. name) for the header; RLS can sometimes leave org undefined with user client
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, type, contact_name, email, phone, portal_features, vertical")
    .eq("id", primaryOrgId)
    .single();

  const contactName = (user.user_metadata?.full_name as string | undefined) || org?.contact_name || user.email?.split("@")[0] || "Partner";
  const firstName = contactName.split(" ")[0];

  // Display name for header: prefer organization name, then contact name (e.g. "Avenue Road"), so it never shows generic "Partner" when we have org details
  const orgDisplayName = (org?.name || org?.contact_name || "Partner").trim() || "Partner";

  return (
    <PartnerPortalClient
      orgId={org?.id || primaryOrgId}
      orgName={orgDisplayName}
      orgType={org?.type || "retail"}
      contactName={firstName}
      userEmail={user.email || ""}
      portalFeatures={org?.portal_features ?? null}
    />
  );
}
