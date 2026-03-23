import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format-currency";

export const metadata = { title: "Referral Partners" };

import RealtorsTable from "./RealtorsTable";

export default async function RealtorsPage() {
  const db = createAdminClient();
  const [refRes, orgRes, realtorsRes, movesRes] = await Promise.all([
    db.from("referrals").select("*").order("created_at", { ascending: false }),
    db.from("organizations").select("id, name"),
    db.from("realtors").select("id, agent_name, email, brokerage, created_at").order("agent_name"),
    db.from("moves").select("id, client_name"),
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
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && (r.status === "booked" || r.status === "completed") && d >= thisMonthStart && d <= now;
  }).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6">
        <BackButton label="Partners" href="/admin/platform?tab=partners" />
      </div>

      <div className="mb-8">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Partners</p>
        <h1 className="font-heading text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Referral Partners</h1>
        <p className="mt-2 text-[13px] text-[var(--tx3)] max-w-2xl leading-relaxed">
          Referrals from referral partners — led by <span className="text-[var(--tx2)] font-medium">realtors</span> (property managers &amp; developers share the same pipeline).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-8">
        <KpiCard label="Total Referrals" value={String(all.length)} sub={`${referralsThisMonth} this month`} />
        <KpiCard label="Booked" value={String(booked)} sub={`${bookedThisMonth} this month`} accent={booked > 0} />
        <KpiCard label="Commission" value={formatCurrency(totalCommission)} sub="all time" />
        <KpiCard label="Realtors" value={String(realtors.length)} sub="partner agents" />
      </div>

      <RealtorsTable
        referrals={all}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
        realtors={realtors}
      />
    </div>
  );
}