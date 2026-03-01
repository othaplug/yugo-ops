import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PartnerPortalClient from "./PartnerPortalClient";

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: partnerUser } = await supabase.from("partner_users").select("org_id").eq("user_id", user.id).single();
  if (!partnerUser) redirect("/partner/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, contact_name, email, phone")
    .eq("id", partnerUser.org_id)
    .single();

  const contactName = org?.contact_name || user.email?.split("@")[0] || "Partner";
  const firstName = contactName.split(" ")[0];

  return (
    <PartnerPortalClient
      orgId={org?.id || partnerUser.org_id}
      orgName={org?.name || "Partner"}
      orgType={org?.type || "retail"}
      contactName={firstName}
      userEmail={user.email || ""}
    />
  );
}
