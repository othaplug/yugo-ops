import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { StatPctChange } from "../../components/StatPctChange";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency } from "@/lib/format-currency";
import { ScheduleDeliveryItem } from "../../components/ScheduleItem";

export default async function RetailPage() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    supabase.from("organizations").select("*, created_at").eq("type", "retail").order("name"),
    supabase.from("deliveries").select("*").eq("category", "retail").order("scheduled_date"),
    supabase.from("invoices").select("client_name, amount, status, created_at"),
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
  const revenueTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
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

  const byPartner: Record<string, { revenue: number; owing: number }> = {};
  clients.forEach((c) => {
    byPartner[c.name || ""] = { revenue: 0, owing: 0 };
  });
  paid.forEach((i) => {
    if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].revenue += Number(i.amount);
  });
  outstanding.forEach((i) => {
    if (i.client_name && byPartner[i.client_name]) byPartner[i.client_name].owing += Number(i.amount);
  });

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
        <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>
        {/* Metrics - 4 cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--tx)]">{clients.length}</span>
              <StatPctChange current={clients.length} previous={partnersPrev} />
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--tx)]">{dels.length}</span>
              <StatPctChange current={deliveriesThisMonth} previous={deliveriesLastMonth} />
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue ({monthLabel})</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--grn)]">{formatCurrency(revenueThisMonth)}</span>
              <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
            <div className={`text-xl font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCurrency(outstandingTotal)}</div>
          </div>
        </div>

        {/* Partners */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">{clients.length} Partners</h3>
          <div className="flex gap-2">
            <Link href="/admin/deliveries/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all whitespace-nowrap">
              Create Project
            </Link>
            <Link href="/admin/clients/new?type=partner&partnerType=retail" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap">
              Add Partner
            </Link>
          </div>
        </div>
        <div className="dl mt-2">
        {clients.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
            No retail partners yet. <Link href="/admin/clients/new?type=partner&partnerType=retail" className="text-[var(--gold)] hover:underline">Add one</Link>
          </div>
        ) : clients.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}?from=retail`}
            className="block bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 mb-1.5 hover:border-[var(--gold)] transition-all cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xs font-semibold">{c.name}</div>
                <div className="text-[9px] text-[var(--tx3)]">{c.contact_name} • {c.email}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold text-[var(--tx2)]">{c.deliveries_per_month || 0} AVG DEL</div>
                {(byPartner[c.name || ""]?.revenue ?? 0) > 0 && (
                  <div className="text-[9px] text-[var(--grn)]">{formatCurrency(byPartner[c.name || ""].revenue)}</div>
                )}
                {(byPartner[c.name || ""]?.owing ?? 0) > 0 && (
                  <div className="text-[9px] text-[var(--org)]">{formatCurrency(byPartner[c.name || ""].owing)} owing</div>
                )}
              </div>
            </div>
          </Link>
        ))}
        </div>

        {/* Recent Deliveries */}
        <div className="glass rounded-xl overflow-hidden mt-6">
          <div className="sh px-4 pt-4">
            <div className="sh-t">Recent Deliveries</div>
            <Link href="/admin/deliveries" className="sh-l">All →</Link>
          </div>
          <div className="divide-y divide-[var(--brd)]/50 px-4 pb-4">
            {dels.length === 0 ? (
              <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
                No deliveries yet
              </div>
            ) : dels.slice(0, 5).map((d) => (
              <ScheduleDeliveryItem
                key={d.id}
                href={getDeliveryDetailPath(d)}
                timeSlot={d.time_slot || "—"}
                pill={`${Array.isArray(d.items) ? d.items.length : 0} items`}
                status={(d.status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                title={`${d.customer_name} (${d.client_name})`}
                subtitle={`Retail • ${d.client_name}`}
              />
            ))}
          </div>
        </div>
    </div>
  );
}