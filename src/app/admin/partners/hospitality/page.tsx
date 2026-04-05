import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Hospitality" };

import BackButton from "../../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import HospitalityClient from "./HospitalityClient";

export default async function HospitalityPage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    db.from("organizations").select("*, created_at").eq("type", "hospitality").order("name"),
    db.from("deliveries").select("*").eq("category", "hospitality").order("created_at", { ascending: false }),
    db.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const clients = orgs || [];
  const dels = deliveries || [];
  const hospitalityNames = new Set(clients.map((c) => c.name).filter(Boolean));
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "short" });
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const hospitalityInvoices = (invoices || []).filter((i) => i.client_name && hospitalityNames.has(i.client_name));
  const paid = hospitalityInvoices.filter((i) => i.status === "paid");
  const outstanding = hospitalityInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const revenueThisMonth = paid.filter((i) => {
    const d = i.created_at ? new Date(i.created_at) : null;
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, i) => s + Number(i.amount), 0);
  const revenueLastMonth = paid.filter((i) => {
    const d = i.created_at ? new Date(i.created_at) : null;
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  }).reduce((s, i) => s + Number(i.amount), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount), 0);

  const partnersPrev = clients.filter((c) => {
    const d = c.created_at ? new Date(c.created_at) : null;
    return d && d < thisMonthStart;
  }).length;
  const deliveriesThisMonth = dels.filter((d) => {
    const sd = d.scheduled_date ? new Date(d.scheduled_date) : null;
    return sd && sd >= thisMonthStart && sd <= now;
  }).length;
  const deliveriesLastMonth = dels.filter((d) => {
    const sd = d.scheduled_date ? new Date(d.scheduled_date) : null;
    return sd && sd >= lastMonthStart && sd <= lastMonthEnd;
  }).length;

  const byPartner: Record<string, { revenue: number; owing: number; deliveryCount: number }> = {};
  clients.forEach((c) => { byPartner[c.name || ""] = { revenue: 0, owing: 0, deliveryCount: 0 }; });
  paid.forEach((i) => { if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].revenue += Number(i.amount); });
  outstanding.forEach((i) => { if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].owing += Number(i.amount); });
  dels.forEach((d) => { if (d.client_name && byPartner[d.client_name]) byPartner[d.client_name].deliveryCount += 1; });

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Partners" href="/admin/platform?tab=partners" /></div>

      <div className="mb-8">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Partners</p>
        <h1 className="admin-page-hero text-[var(--tx)]">Hospitality</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Partners" value={String(clients.length)} sub="active accounts" />
        <KpiCard label="Deliveries" value={String(dels.length)} sub={`${deliveriesThisMonth} this month`} />
        <KpiCard label={`Revenue (${monthLabel})`} value={formatCompactCurrency(revenueThisMonth)} sub="paid invoices" accent />
        <KpiCard label="Outstanding" value={formatCompactCurrency(outstandingTotal)} sub="awaiting payment" warn={outstandingTotal > 0} />
      </div>

      <SectionDivider label="Activity" />
      <HospitalityClient
        clients={JSON.parse(JSON.stringify(clients))}
        deliveries={JSON.parse(JSON.stringify(dels))}
        byPartner={byPartner}
      />
    </div>
  );
}
