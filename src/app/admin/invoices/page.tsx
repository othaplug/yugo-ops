import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const sent = all.filter((i) => i.status === "sent");
  const overdue = all.filter((i) => i.status === "overdue");
  const draft = all.filter((i) => i.status === "draft");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const sentTotal = sent.reduce((s, i) => s + Number(i.amount), 0);
  const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--gold)] rounded-xl p-4 md:p-5 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total</div>
          <div className="text-xl md:text-2xl font-bold font-heading text-[var(--tx)]">{all.length}</div>
        </Link>
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--grn)] rounded-xl p-4 md:p-5 hover:border-[var(--grn)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Paid</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(paidTotal)}</div>
        </Link>
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--blue)] rounded-xl p-4 md:p-5 hover:border-[var(--blue)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Pending / Sent</div>
          <div className="text-xl font-bold font-heading text-[var(--blue)]">{formatCompactCurrency(sentTotal)}</div>
        </Link>
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--red)] rounded-xl p-4 md:p-5 hover:border-[var(--red)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Overdue</div>
          <div className="text-xl font-bold font-heading text-[var(--red)]">{formatCompactCurrency(overdueTotal)}</div>
        </Link>
        <Link href="/admin/moves" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] border-l-4 border-l-[var(--tx3)] rounded-xl p-4 md:p-5 hover:border-[var(--tx3)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Draft</div>
          <div className="text-xl font-bold font-heading text-[var(--tx2)]">{draft.length}</div>
        </Link>
      </div>
      <InvoicesPageClient invoices={all} />
    </div>
  );
}