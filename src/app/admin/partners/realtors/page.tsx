import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format-currency";
import { REFERRAL_HUB_ORG_TYPES } from "@/lib/partner-type";

export const metadata = { title: "Referral Partners" };

import RealtorsTable from "./RealtorsTable";
import RealtorPartnersSection from "./RealtorPartnersSection";
import { ReferralPartnersPageHero } from "./ReferralPartnersPageHero";

export default async function RealtorsPage() {
  const db = createAdminClient();
  const [refRes, orgRes, realtorsRes, movesRes, referralOrgRes] = await Promise.all([
    db.from("referrals").select("*").order("created_at", { ascending: false }),
    db.from("organizations").select("id, name"),
    db.from("realtors").select("id, agent_name, email, brokerage, created_at").order("agent_name"),
    db.from("moves").select("id, client_name"),
    db
      .from("organizations")
      .select("id, name, contact_name, email, type")
      .in("type", [...REFERRAL_HUB_ORG_TYPES])
      .order("name"),
  ]);
  const referrals = refRes.data ?? [];
  const orgs = orgRes.data ?? [];
  const realtors = realtorsRes.data ?? [];
  const moves = movesRes.data ?? [];

  const all = referrals || [];
  const clientNameToId: Record<string, string> = {};
  (orgs || []).forEach((o) => { if (o.name) clientNameToId[o.name] = o.id; });
  const clientNameToMoveId: Record<string, string> = {};
  moves.forEach((m: { id: string; client_name?: string }) => { if (m.client_name) clientNameToMoveId[m.client_name] = m.id; });
  const booked = all.filter((r) => r.status === "booked" || r.status === "completed").length;
  const totalCommission = all.reduce((s, r) => s + Number(r.commission || 0), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const referralsThisMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && d >= thisMonthStart && d <= now;
  }).length;

  const bookedThisMonth = all.filter((r) => {
    if (r.status !== "booked" && r.status !== "completed") return false;
    const raw = (r as { updated_at?: string }).updated_at || r.created_at;
    const d = raw ? new Date(raw) : null;
    return d != null && !Number.isNaN(d.getTime()) && d >= thisMonthStart && d <= now;
  }).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6">
        <BackButton label="Partners" href="/admin/platform?tab=partners" />
      </div>

      <ReferralPartnersPageHero />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-8">
        <KpiCard label="Total Referrals" value={String(all.length)} sub={`${referralsThisMonth} this month`} />
        <KpiCard label="Booked" value={String(booked)} sub={`${bookedThisMonth} this month`} accent={booked > 0} />
        <KpiCard label="Commission" value={formatCurrency(totalCommission)} sub="all time" />
        <KpiCard label="Realtors" value={String(realtors.length)} sub="partner agents" />
      </div>

      <RealtorPartnersSection partners={referralOrgRes.data ?? []} />

      <RealtorsTable
        referrals={all}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
        realtors={realtors}
      />
    </div>
  );
}