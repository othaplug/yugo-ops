import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import { Icon } from "@/components/AppIcons";
import Badge from "../../components/Badge";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { formatCurrency } from "@/lib/format-currency";

export default async function RetailPage() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    supabase.from("organizations").select("*").eq("type", "retail").order("name"),
    supabase.from("deliveries").select("*").eq("category", "retail").order("scheduled_date"),
    supabase.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const clients = orgs || [];
  const dels = deliveries || [];
  const retailNames = new Set(clients.map((c) => c.name).filter(Boolean));
  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "short" });

  const retailInvoices = (invoices || []).filter((i) => i.client_name && retailNames.has(i.client_name));
  const paid = retailInvoices.filter((i) => i.status === "paid");
  const outstanding = retailInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const paidThisMonth = paid.filter((i) => {
    const d = i.created_at ? new Date(i.created_at) : null;
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const revenueTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const revenueThisMonth = paidThisMonth.reduce((s, i) => s + Number(i.amount), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount), 0);

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
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
            <div className="text-xl font-bold font-heading">{clients.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Deliveries</div>
            <div className="text-xl font-bold font-heading">{dels.length}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">On-Time</div>
            <div className="text-xl font-bold font-heading text-[var(--grn)]">100%</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue ({monthLabel})</div>
            <div className="text-xl font-bold font-heading">{formatCurrency(revenueThisMonth)}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
            <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
            <div className={`text-xl font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCurrency(outstandingTotal)}</div>
          </div>
        </div>

        {/* Partners */}
        <div className="sh">
          <div className="sh-t">{clients.length} Partners</div>
          <Link href="/admin/clients/new?type=partner&partnerType=retail" className="sh-l">+ Add Partner</Link>
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
        <div className="sh mt-6">
          <div className="sh-t">Recent Deliveries</div>
          <Link href="/admin/deliveries" className="sh-l">All →</Link>
        </div>
        <div className="dl mt-2">
          {dels.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No deliveries yet
            </div>
          ) : dels.slice(0, 5).map((d) => (
            <Link
              key={d.id}
              href={getDeliveryDetailPath(d)}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] text-[var(--tx2)]"><Icon name="sofa" className="w-[16px] h-[16px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name} ({d.client_name})</div>
                <div className="text-[9px] text-[var(--tx3)]">{Array.isArray(d.items) ? d.items.length : 0} items</div>
              </div>
              <div className="text-[10px] text-[var(--tx3)]">{d.time_slot}</div>
              <Badge status={d.status} />
            </Link>
          ))}
        </div>
    </div>
  );
}