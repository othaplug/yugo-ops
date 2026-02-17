import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PartnerSignOut from "./PartnerSignOut";

export default async function PartnerDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/partner/login");

  const { data: partnerUser } = await supabase.from("partner_users").select("org_id").eq("user_id", user.id).single();
  if (!partnerUser) redirect("/partner/login");

  const { data: org } = await supabase.from("organizations").select("name, type").eq("id", partnerUser.org_id).single();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--brd)] bg-[var(--card)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-hero text-[18px] tracking-[2px] text-[var(--gold)]">OPS+</span>
          <span className="text-[11px] text-[var(--tx3)]">Partner</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[var(--tx2)]">{user.email}</span>
          <PartnerSignOut />
        </div>
      </header>
      <main className="max-w-[800px] mx-auto px-4 py-8">
        <h1 className="font-heading text-[22px] font-bold text-[var(--tx)]">{org?.name || "Partner dashboard"}</h1>
        <p className="text-[13px] text-[var(--tx3)] mt-1">Partner portal — coming soon</p>
        <p className="mt-4">
          <Link href="/admin" className="text-[12px] text-[var(--gold)] hover:underline">
            Go to admin dashboard
          </Link>
        </p>
      </main>
    </div>
  );
}
