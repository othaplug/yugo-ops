import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ProfitabilityClient from "./ProfitabilityClient";

export const dynamic = "force-dynamic";

export default async function ProfitabilityPage() {
  const supabase = await createClient();
  const db = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (pu?.role !== "owner") redirect("/admin");

  return <ProfitabilityClient />;
}
