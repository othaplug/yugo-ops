import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookDayRateClient from "./BookDayRateClient";

export default async function BookDayRatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: partnerRows, error: partnerError } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (partnerError || !partnerRows?.length) redirect("/partner/login?error=no_org");
  const primaryOrgId = partnerRows[0].org_id;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, default_pickup_address")
    .eq("id", primaryOrgId)
    .single();

  if (!org?.id) redirect("/partner/login?error=no_org");

  return (
    <BookDayRateClient
      orgId={org.id}
      orgType={org.type || "retail"}
      defaultPickupAddress={org.default_pickup_address || ""}
    />
  );
}
