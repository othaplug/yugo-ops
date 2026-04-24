import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "Settings, Feature flags" };

export default async function PlatformFeatureFlagsRedirect() {
  const supabase = await createClient();
  const db = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: platformUser } = user
    ? await db
        .from("platform_users")
        .select("role")
        .eq("user_id", user.id)
        .single()
    : { data: null };
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const isOwner = isSuperAdmin || platformUser?.role === "owner";
  if (!isOwner) redirect("/admin/settings/personal");
  redirect("/admin/platform?tab=app");
}
