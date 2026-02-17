import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/partner/login");
  }

  const { data: platformUser } = await supabase.from("platform_users").select("user_id").eq("user_id", user.id).single();
  const { data: partnerUser } = await supabase.from("partner_users").select("user_id").eq("user_id", user.id).single();

  if (platformUser && !partnerUser) redirect("/admin");
  if (!partnerUser) redirect("/partner/login");

  return <>{children}</>;
}
