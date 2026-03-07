import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPlatformToggles } from "@/lib/platform-settings";

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const toggles = await getPlatformToggles();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  if (!toggles.partner_portal) redirect("/portal-disabled");

  const { data: platformUser, error: puErr } = await supabase.from("platform_users").select("user_id").eq("user_id", user.id).single();
  const { data: partnerRows, error: prErr } = await supabase.from("partner_users").select("user_id").eq("user_id", user.id).limit(1);
  const hasPartnerAccess = partnerRows && partnerRows.length > 0;

  console.log("[partner-layout]", {
    userId: user.id,
    email: user.email,
    platformUser: !!platformUser,
    puErr: puErr?.message || null,
    partnerRows: partnerRows?.length ?? "null",
    prErr: prErr?.message || null,
    hasPartnerAccess,
  });

  if (platformUser && !hasPartnerAccess) redirect("/admin");

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {children}
    </div>
  );
}
