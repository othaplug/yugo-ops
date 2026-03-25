export const metadata = { title: "Change Requests" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import ChangeRequestsClient from "./ChangeRequestsClient";

export default async function ChangeRequestsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("move_change_requests")
    .select(`
      id,
      move_id,
      type,
      description,
      urgency,
      status,
      created_at,
      reviewed_at,
      moves (
        id,
        client_name,
        client_email,
        move_code,
        from_address,
        to_address,
        scheduled_date
      )
    `)
    .order("created_at", { ascending: false });

  const all = requests || [];
  const pending = all.filter((r: any) => r.status === "pending");
  const reviewed = all.filter((r: any) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-5 md:px-6 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Back" /></div>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Operations</p>
          <h1 className="font-hero text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Change Requests</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Pending" value={String(pending.length)} sub="awaiting review" warn={pending.length > 0} />
        <KpiCard label="Reviewed" value={String(reviewed.length)} sub="actioned" accent={reviewed.length > 0} />
        <KpiCard label="Total" value={String(all.length)} sub="all time" />
      </div>

      <SectionDivider label="Requests" />
      <ChangeRequestsClient
        all={all}
        pending={pending}
        reviewed={reviewed}
      />
    </div>
  );
}
