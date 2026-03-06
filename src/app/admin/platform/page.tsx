export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PlatformSettingsClient from "./PlatformSettingsClient";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { getPlatformToggles } from "@/lib/platform-settings";

export default async function PlatformPage() {
  const supabase = await createClient();
  const db = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: platformUser } = await db.from("platform_users").select("role").eq("user_id", user?.id).single();
  const isSuperAdmin = isSuperAdminEmail(user?.email);
  const isAdmin = isSuperAdmin || ["owner", "admin", "manager"].includes(platformUser?.role || "");
  if (!isAdmin) redirect("/admin");

  const toggles = await getPlatformToggles();
  const initialToggles = {
    crewTracking: toggles.crew_tracking,
    partnerPortal: toggles.partner_portal,
    autoInvoicing: toggles.auto_invoicing,
  };

  let crewsResult = await db.from("crews").select("id, name, members, active").order("name");
  if (crewsResult.error && String(crewsResult.error.message).includes("active")) {
    crewsResult = await db.from("crews").select("id, name, members").order("name") as typeof crewsResult;
  }
  const crews = crewsResult.data || [];
  const initialTeams = crews.map((c: { id: string; name: string; members?: unknown[]; active?: boolean }) => ({
    id: c.id,
    label: c.name,
    memberIds: (Array.isArray(c.members) ? c.members : []).map((m: unknown) => {
      if (m == null) return "";
      if (typeof m === "string") return m.trim();
      if (typeof m === "object" && m !== null && "name" in m) return String((m as { name?: unknown }).name ?? "").trim();
      return String(m).trim();
    }).filter(Boolean),
    active: typeof (c as { active?: boolean }).active === "boolean" ? (c as { active: boolean }).active : true,
  }));

  return (
    <div className="w-full max-w-[720px] min-w-0 mx-auto px-4 sm:px-5 md:px-6 py-6 md:py-8 animate-fade-up">
      <PlatformSettingsClient initialTeams={initialTeams} initialToggles={initialToggles} currentUserId={user?.id} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
