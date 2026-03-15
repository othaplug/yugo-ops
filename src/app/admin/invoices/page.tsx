export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function InvoicesPage() {
  const db = createAdminClient();
  const { data: invoices } = await db.from("invoices").select("*").order("created_at", { ascending: false });

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 md:gap-6 mb-8 pt-6 border-t border-[var(--brd)]/30">
        <Link href="/admin/revenue" className="block group">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Total</div>
          <div className="text-[24px] font-bold font-heading text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{all.length}</div>
        </Link>
        <Link href="/admin/revenue" className="block group">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Paid</div>
          <div className="text-[24px] font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(paidTotal)}</div>
        </Link>
        <Link href="/admin/revenue" className="block group">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Pending / Sent</div>
          <div className="text-[24px] font-bold font-heading text-[var(--blue)]">{formatCompactCurrency(sentTotal)}</div>
        </Link>
        <Link href="/admin/revenue" className="block group">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Overdue</div>
          <div className="text-[24px] font-bold font-heading text-[var(--red)]">{formatCompactCurrency(overdueTotal)}</div>
        </Link>
        <Link href="/admin/moves" className="block group">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Draft</div>
          <div className="text-[24px] font-bold font-heading text-[var(--tx2)]">{draft.length}</div>
        </Link>
      </div>
      <InvoicesPageClient invoices={all} />
    </div>
  );
}