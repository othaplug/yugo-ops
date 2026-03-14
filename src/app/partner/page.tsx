import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PartnerPortalClient from "./PartnerPortalClient";

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

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, contact_name, email, phone, portal_features, vertical")
    .eq("id", primaryOrgId)
    .single();

  const contactName = (user.user_metadata?.full_name as string | undefined) || org?.contact_name || user.email?.split("@")[0] || "Partner";
  const firstName = contactName.split(" ")[0];

  return (
    <PartnerPortalClient
      orgId={org?.id || primaryOrgId}
      orgName={org?.name || "Partner"}
      orgType={org?.type || "retail"}
      contactName={firstName}
      userEmail={user.email || ""}
      portalFeatures={org?.portal_features ?? null}
    />
  );
}
