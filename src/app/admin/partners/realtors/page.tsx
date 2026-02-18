import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import RealtorsTable from "./RealtorsTable";
import RealtorsMetrics from "./RealtorsMetrics";

export default async function RealtorsPage() {
  const supabase = await createClient();
  const [refRes, orgRes, realtorsRes, movesRes] = await Promise.all([
    supabase.from("referrals").select("*").order("created_at", { ascending: false }),
    supabase.from("organizations").select("id, name"),
    supabase.from("realtors").select("id, agent_name, email, brokerage, created_at").order("agent_name"),
    supabase.from("moves").select("id, client_name"),
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
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const referralsThisMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && d >= thisMonthStart && d <= now;
  }).length;
  const referralsLastMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  const bookedThisMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && (r.status === "booked" || r.status === "completed") && d >= thisMonthStart && d <= now;
  }).length;
  const bookedLastMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && (r.status === "booked" || r.status === "completed") && d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  const commissionThisMonth = all
    .filter((r) => {
      const d = r.created_at ? new Date(r.created_at) : null;
      return d && d >= thisMonthStart && d <= now;
    })
    .reduce((s, r) => s + Number(r.commission || 0), 0);
  const commissionLastMonth = all
    .filter((r) => {
      const d = r.created_at ? new Date(r.created_at) : null;
      return d && d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((s, r) => s + Number(r.commission || 0), 0);

  const realtorsPrev = realtors.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && d < thisMonthStart;
  }).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>
      <RealtorsMetrics
        referralsCount={all.length}
        booked={booked}
        totalCommission={totalCommission}
        realtorsCount={realtors.length}
        realtors={realtors}
        referralsThisMonth={referralsThisMonth}
        referralsPrev={referralsLastMonth}
        bookedThisMonth={bookedThisMonth}
        bookedPrev={bookedLastMonth}
        commissionThisMonth={commissionThisMonth}
        commissionPrev={commissionLastMonth}
        realtorsPrev={realtorsPrev}
      />
      <RealtorsTable
        referrals={all}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
        realtors={realtors}
      />
    </div>
  );
}