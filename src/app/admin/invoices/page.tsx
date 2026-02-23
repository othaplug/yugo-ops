import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const [{ data: invoices }, { data: moves }] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    supabase.from("moves").select("id"),
  ]);

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const outstanding = all.filter((i) => i.status === "sent" || i.status === "overdue");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount), 0);

  const moveIdsWithInvoice = new Set((all.filter((i) => i.move_id) as { move_id: string }[]).map((i) => i.move_id));
  const awaitingInvoiceCount = (moves || []).filter((m) => !moveIdsWithInvoice.has(m.id)).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4 md:p-5 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Invoices</div>
          <div className="text-xl md:text-2xl font-bold font-heading text-[var(--tx)]">{all.length}</div>
        </Link>
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Paid</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(paidTotal)}</div>
        </Link>
        <Link href="/admin/revenue" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">{formatCompactCurrency(outstandingTotal)}</div>
        </Link>
        <Link href="/admin/moves" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Awaiting invoice</div>
          <div className="text-xl font-bold font-heading text-[var(--tx)]">{awaitingInvoiceCount}</div>
          <div className="text-[9px] text-[var(--tx3)] mt-1">Jobs with no invoice sent</div>
        </Link>
      </div>
      <InvoicesPageClient invoices={all} />
    </div>
  );
}