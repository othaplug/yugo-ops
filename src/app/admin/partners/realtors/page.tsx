import { createClient } from "@/lib/supabase/server";
import Topbar from "../../components/Topbar";
import Badge from "../../components/Badge";

export default async function RealtorsPage() {
  const supabase = await createClient();
  const { data: referrals } = await supabase
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false });

  const all = referrals || [];
  const booked = all.filter((r) => r.status === "booked" || r.status === "completed").length;
  const totalCommission = all.reduce((s, r) => s + Number(r.commission || 0), 0);

  return (
    <>
      <Topbar title="Realtor Partners" subtitle="Referrals & commissions" />
      <div className="max-w-[1200px] px-6 py-5">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Referrals</div>
            <div className="text-xl font-bold font-serif">{all.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Booked</div>
            <div className="text-xl font-bold font-serif text-[var(--grn)]">{booked}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Commission</div>
            <div className="text-xl font-bold font-serif">${totalCommission.toLocaleString()}</div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Agent", "Client", "Property", "Tier", "Status", "Comm."].map((h) => (
                  <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--gdim)] transition-colors">
                  <td className="px-3 py-2 border-b border-[var(--brd)]">
                    <div className="text-[10px] font-semibold">{r.agent_name}</div>
                    <div className="text-[8px] text-[var(--tx3)]">{r.brokerage}</div>
                  </td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">{r.client_name}</td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">{r.property}</td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">{r.tier}</td>
                  <td className="px-3 py-2 border-b border-[var(--brd)]"><Badge status={r.status} /></td>
                  <td className="px-3 py-2 text-[10px] font-semibold border-b border-[var(--brd)]">
                    {r.commission > 0 ? `$${Number(r.commission).toLocaleString()}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}