export const metadata = { title: "Platform Settings" };
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
  const isOwner = isSuperAdmin || platformUser?.role === "owner";
  if (!isOwner) redirect("/admin");

  const toggles = await getPlatformToggles();
  const initialToggles = {
    crewTracking: toggles.crew_tracking,
    partnerPortal: toggles.partner_portal,
    autoInvoicing: toggles.auto_invoicing,
  };

  const { data: reviewConfig } = await db
    .from("platform_config")
    .select("key, value")
    .in("key", ["auto_review_requests", "google_review_url"]);
  const reviewConfigMap: Record<string, string> = {};
  for (const r of reviewConfig ?? []) reviewConfigMap[r.key] = r.value ?? "";
  const initialReviewConfig = {
    autoReviewRequests: reviewConfigMap.auto_review_requests === "true" || reviewConfigMap.auto_review_requests === "1",
    googleReviewUrl: reviewConfigMap.google_review_url || "https://g.page/r/CU67iDN6TgMIEB0/review/",
  };

  let crewsResult = await db.from("crews").select("id, name, members, active, phone").order("name");
  if (crewsResult.error && String(crewsResult.error.message).includes("active")) {
    crewsResult = await db.from("crews").select("id, name, members").order("name") as typeof crewsResult;
  }
  const crews = crewsResult.data || [];

  // Look up tablet phone numbers from registered_devices for each team
  const { data: activeDevices } = await db
    .from("registered_devices")
    .select("default_team_id, phone")
    .eq("is_active", true)
    .not("phone", "is", null)
    .order("last_active_at", { ascending: false });
  const devicePhoneByTeam: Record<string, string> = {};
  for (const dev of activeDevices || []) {
    if (dev.default_team_id && dev.phone && !devicePhoneByTeam[dev.default_team_id]) {
      devicePhoneByTeam[dev.default_team_id] = dev.phone;
    }
  }

  const initialTeams = crews.map((c: { id: string; name: string; members?: unknown[]; active?: boolean; phone?: string }) => ({
    id: c.id,
    label: c.name,
    memberIds: (Array.isArray(c.members) ? c.members : []).map((m: unknown) => {
      if (m == null) return "";
      if (typeof m === "string") return m.trim();
      if (typeof m === "object" && m !== null && "name" in m) return String((m as { name?: unknown }).name ?? "").trim();
      return String(m).trim();
    }).filter(Boolean),
    active: typeof (c as { active?: boolean }).active === "boolean" ? (c as { active: boolean }).active : true,
    phone: devicePhoneByTeam[c.id] || (c as { phone?: string }).phone || "",
  }));

  return (
    <div className="w-full max-w-[1100px] min-w-0 mx-auto px-4 sm:px-5 md:px-6 py-6 md:py-8 animate-fade-up">
      <div className="mb-8">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Admin</p>
        <h1 className="admin-page-hero text-[var(--tx)]">Platform Settings</h1>
      </div>
      <PlatformSettingsClient initialTeams={initialTeams} initialToggles={initialToggles} initialReviewConfig={initialReviewConfig} currentUserId={user?.id} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
