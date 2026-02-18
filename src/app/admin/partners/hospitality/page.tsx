import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import Badge from "../../components/Badge";
import { StatPctChange } from "../../components/StatPctChange";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency } from "@/lib/format-currency";

export default async function HospitalityPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    supabase.from("organizations").select("*, created_at").eq("type", "hospitality").order("name"),
    supabase.from("deliveries").select("*").eq("category", "hospitality").order("scheduled_date"),
    supabase.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const orgsList = orgs || [];
  const delsList = deliveries || [];
  const hospitalityNames = new Set(orgsList.map((c) => c.name).filter(Boolean));
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "short" });
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const hospitalityInvoices = (invoices || []).filter((i) => i.client_name && hospitalityNames.has(i.client_name));
  const paid = hospitalityInvoices.filter((i) => i.status === "paid");
  const outstanding = hospitalityInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
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

  const partnersPrev = orgsList.filter((c) => {
    const d = c.created_at ? new Date(c.created_at) : null;
    return d && d < thisMonthStart;
  }).length;
  const deliveriesThisMonth = delsList.filter((d) => {
    const sd = d.scheduled_date ? new Date(d.scheduled_date) : null;
    return sd && sd >= thisMonthStart && sd <= now;
  }).length;
  const deliveriesLastMonth = delsList.filter((d) => {
    const sd = d.scheduled_date ? new Date(d.scheduled_date) : null;
    return sd && sd >= lastMonthStart && sd <= lastMonthEnd;
  }).length;

  const byPartner: Record<string, { revenue: number; owing: number }> = {};
  orgsList.forEach((c) => {
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--tx)]">{orgsList.length}</span>
              <StatPctChange current={orgsList.length} previous={partnersPrev} />
            </div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--tx)]">{delsList.length}</span>
              <StatPctChange current={deliveriesThisMonth} previous={deliveriesLastMonth} />
            </div>
          </div>
          <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue ({monthLabel})</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-heading text-[var(--grn)]">{formatCurrency(revenueThisMonth)}</span>
              <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
            </div>
          </Link>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
            <div className={`text-xl font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCurrency(outstandingTotal)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">{orgsList.length} Partners</h3>
          <div className="flex gap-2">
            <Link href="/admin/deliveries/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all whitespace-nowrap">
              Create Project
            </Link>
            <Link href="/admin/clients/new?type=partner&partnerType=hospitality" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap">
              Add Partner
            </Link>
          </div>
        </div>
        <div className="dl mt-2">
        {orgsList.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
            No hospitality partners yet. <Link href="/admin/clients/new?type=partner&partnerType=hospitality" className="text-[var(--gold)] hover:underline">Add one</Link>
          </div>
        ) : orgsList.map((c) => (
          <Link
            key={c.id}
            href={`/admin/clients/${c.id}?from=hospitality`}
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

        <div className="sh mt-6">
          <div className="sh-t">Recent Deliveries</div>
          <Link href="/admin/deliveries" className="sh-l">All →</Link>
        </div>
        <div className="dl mt-2">
          {delsList.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No deliveries yet
            </div>
          ) : delsList.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              href={getDeliveryDetailPath(d)}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--ordim)] text-[var(--tx2)]"><Icon name="hotel" className="w-[16px] h-[16px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)]">{Array.isArray(d.items) ? d.items.length : 0} items</div>
              </div>
              <Badge status={d.status} />
            </Link>
          ))}
        </div>
    </div>
  );
}