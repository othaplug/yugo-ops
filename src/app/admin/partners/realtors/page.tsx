import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
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
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      {/* Metrics - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Referrals</div>
          <div className="text-xl font-bold font-heading">{all.length}</div>
        </Link>
        <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Booked</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{booked}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Commission</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${totalCommission.toLocaleString()}</div>
        </Link>
        <Link href="/admin/clients/new" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all flex items-center justify-center">
          <span className="text-[10px] font-semibold text-[var(--gold)]">+ Add Realtor</span>
        </Link>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Referral Pipeline</h3>
          <Link href="/admin/clients/new" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
            + Add referral
          </Link>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Agent", "Client", "Property", "Tier", "Status", "Comm."].map((h) => (
                <th key={h} className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.id} className="hover:bg-[var(--gdim)] transition-colors cursor-pointer">
                <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                  <div className="text-[10px] font-semibold">{r.agent_name}</div>
                  <div className="text-[9px] text-[var(--tx3)]">{r.brokerage}</div>
                </td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.client_name}</td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.property}</td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.tier}</td>
                <td className="px-4 py-2.5 border-b border-[var(--brd)]"><Badge status={r.status} /></td>
                <td className="px-4 py-2.5 text-[10px] font-semibold border-b border-[var(--brd)]">
                  {r.commission > 0 ? `$${Number(r.commission).toLocaleString()}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}