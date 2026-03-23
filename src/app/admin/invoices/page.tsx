export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
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
      <div className="mb-6"><BackButton label="Back" /></div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Finance</p>
          <h1 className="font-heading text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Invoices</h1>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Total" value={String(all.length)} sub={`${paid.length} paid · ${draft.length} draft`} href="/admin/revenue" />
        <KpiCard label="Paid" value={formatCompactCurrency(paidTotal)} sub={`${paid.length} invoices`} accent href="/admin/revenue" />
        <KpiCard label="Pending / Sent" value={formatCompactCurrency(sentTotal)} sub={`${sent.length} awaiting`} href="/admin/revenue" />
        <KpiCard label="Overdue" value={formatCompactCurrency(overdueTotal)} sub={`${overdue.length} past due`} warn={overdueTotal > 0} href="/admin/revenue" />
        <KpiCard label="Draft" value={String(draft.length)} sub="not yet sent" />
      </div>

      <SectionDivider label="All Invoices" />
      <InvoicesPageClient invoices={all} />
    </div>
  );
}