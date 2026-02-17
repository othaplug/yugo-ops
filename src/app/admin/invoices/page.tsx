import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 md:p-5 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Invoices</div>
          <div className="text-xl md:text-2xl font-bold font-heading text-[var(--tx)]">{all.length}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Paid</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">${(paidTotal / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${(outstandingTotal / 1000).toFixed(1)}K</div>
        </Link>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 flex items-center justify-center">
          <span className="text-[9px] font-semibold text-[var(--tx3)] text-center">Create invoices</span>
        </div>
      </div>
      <InvoicesPageClient invoices={all} />
    </div>
  );
}