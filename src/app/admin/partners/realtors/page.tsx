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
    supabase.from("realtors").select("id, agent_name, email, brokerage").order("agent_name"),
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

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      <RealtorsMetrics referralsCount={all.length} booked={booked} totalCommission={totalCommission} />
      <RealtorsTable
        referrals={all}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
        realtors={realtors}
      />
    </div>
  );
}