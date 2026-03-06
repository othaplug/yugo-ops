import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { isSuperAdminEmail } from "@/lib/super-admin";
import ForecastClient from "./ForecastClient";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();
  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isOwner = pu?.role === "owner" || isSuperAdminEmail(user.email);
  if (!isOwner) redirect("/admin");

  return <ForecastClient />;
}
