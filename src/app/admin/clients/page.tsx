import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import ClientsTableBody from "./ClientsTableBody";

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
                <th className="w-10 px-3 py-2 border-b border-[var(--brd)]" aria-hidden />
              </tr>
            </thead>
            <tbody>
              <ClientsTableBody clients={all} />
            </tbody>
          </table>
        </div>
    </div>
  );
}