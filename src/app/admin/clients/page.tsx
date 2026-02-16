import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import ClientRow from "./ClientRow";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("organizations")
    .select("*")
    .order("name");

  const all = clients || [];

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <BackButton label="Back" />
          <div className="flex gap-1.5">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
          >
            + Add Client
          </Link>
          <Link
            href="/admin/revenue"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Export
          </Link>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full border-collapse min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Client</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Type</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Contact</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">AVG DEL</th>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Owing</th>
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
                    No clients yet. <Link href="/admin/clients/new" className="text-[var(--gold)] hover:underline">Add one</Link>
                  </td>
                </tr>
              ) : all.map((c) => (
                <ClientRow key={c.id} href={`/admin/clients/${c.id}`}>
                  <td className="px-3 py-2 text-[10px] font-semibold border-b border-[var(--brd)] group-hover:text-[var(--gold)] transition-colors">
                    {c.name}
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
                </ClientRow>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}