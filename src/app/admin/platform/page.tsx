import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PlatformSettingsClient from "./PlatformSettingsClient";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "othaplug@gmail.com";

export default async function PlatformPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = await supabase.from("platform_users").select("role").eq("user_id", user?.id).single();
  const isSuperAdmin = (user?.email || "").toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || platformUser?.role === "admin" || platformUser?.role === "manager";
  if (!isAdmin) redirect("/admin");

  const { data: crews } = await supabase.from("crews").select("id, name, members").order("name");
  const initialTeams = (crews || []).map((c) => ({
    id: c.id,
    label: c.name,
    memberIds: Array.isArray(c.members) ? c.members : [],
    active: true,
  }));

  return (
    <div className="w-full max-w-[720px] min-w-0 mx-auto px-4 sm:px-5 md:px-6 py-6 md:py-8 animate-fade-up">
      <PlatformSettingsClient initialTeams={initialTeams} currentUserId={user?.id} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
