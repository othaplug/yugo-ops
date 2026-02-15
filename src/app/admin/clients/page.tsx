import { createClient } from "@/lib/supabase/server";
import Topbar from "../components/Topbar";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("organizations")
    .select("*")
    .order("name");

  const all = clients || [];

  return (
    <>
      <Topbar title="All Clients" subtitle="Account management" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-5">
        <div className="flex gap-1.5 mb-3">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + Add Client
          </Link>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Client</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Type</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Contact</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Del/Mo</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Owing</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Health</th>
              </tr>
            </thead>
            <tbody>
              {all.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--gdim)] transition-colors cursor-pointer">
                  <td className="px-3 py-2 text-[10px] font-semibold border-b border-[var(--brd)]">
                    <Link href={`/admin/clients/${c.id}`} className="hover:text-[var(--gold)]">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-[10px] capitalize border-b border-[var(--brd)]">{c.type}</td>
                  <td className="px-3 py-2 border-b border-[var(--brd)]">
                    <div className="text-[9px]">{c.contact_name}</div>
                    <div className="text-[9px] text-[var(--tx3)]">{c.email}</div>
                  </td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">{c.deliveries_per_month}</td>
                  <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">
                    {c.outstanding_balance > 0 ? `$${Number(c.outstanding_balance).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 border-b border-[var(--brd)]">
                    <div className={`w-2 h-2 rounded-full ${c.health === "good" ? "bg-[var(--grn)]" : "bg-[var(--org)]"}`} />
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