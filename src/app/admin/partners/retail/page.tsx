import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { StatPctChange } from "../../components/StatPctChange";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import RetailClient from "./RetailClient";

export default async function RetailPage() {
  const db = createAdminClient();

  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    db.from("organizations").select("*, created_at").eq("type", "retail").order("name"),
    db.from("deliveries").select("*").eq("category", "retail").order("scheduled_date", { ascending: false }),
    db.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const clients = orgs || [];
  const dels = deliveries || [];
  const retailNames = new Set(clients.map((c) => c.name).filter(Boolean));
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "short" });
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const retailInvoices = (invoices || []).filter((i) => i.client_name && retailNames.has(i.client_name));
  const paid = retailInvoices.filter((i) => i.status === "paid");
  const outstanding = retailInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const paidThisMonth = paid.filter((i) => {
    const d = i.created_at ? new Date(i.created_at) : null;
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const paidLastMonth = paid.filter((i) => {
    const d = i.created_at ? new Date(i.created_at) : null;
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  });
  const revenueThisMonth = paidThisMonth.reduce((s, i) => s + Number(i.amount), 0);
  const revenueLastMonth = paidLastMonth.reduce((s, i) => s + Number(i.amount), 0);
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
  clients.forEach((c) => {
    byPartner[c.name || ""] = { revenue: 0, owing: 0, deliveryCount: 0 };
  });
  paid.forEach((i) => {
    if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].revenue += Number(i.amount);
  });
  outstanding.forEach((i) => {
    if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].owing += Number(i.amount);
  });
  dels.forEach((d) => {
    if (d.client_name && byPartner[d.client_name]) byPartner[d.client_name].deliveryCount += 1;
  });

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-h2 font-bold text-[var(--tx)]">Retail Partners</h1>
          <p className="text-ui text-[var(--tx3)] mt-0.5">{clients.length} active partner{clients.length !== 1 ? "s" : ""} · {dels.length} total deliveries</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
          <div className="flex items-baseline gap-2">
            <span className="text-h1 font-bold font-heading text-[var(--tx)]">{clients.length}</span>
            <StatPctChange current={clients.length} previous={partnersPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
          <div className="flex items-baseline gap-2">
            <span className="text-h1 font-bold font-heading text-[var(--tx)]">{dels.length}</span>
            <StatPctChange current={deliveriesThisMonth} previous={deliveriesLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue ({monthLabel})</div>
          <div className="flex items-baseline gap-2">
            <span className="text-h1 font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(revenueThisMonth)}</span>
            <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className={`text-h1 font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCompactCurrency(outstandingTotal)}</div>
        </div>
      </div>

      {/* Actions + Tabs - This is the key section */}
      <RetailClient
        clients={JSON.parse(JSON.stringify(clients))}
        deliveries={JSON.parse(JSON.stringify(dels))}
        byPartner={byPartner}
      />
    </div>
  );
}
