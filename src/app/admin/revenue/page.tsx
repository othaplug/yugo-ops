import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function RevenuePage() {
  const supabase = await createClient();
  const { data: invoices } = await supabase.from("invoices").select("*");

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = all
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);
  const overdueTotal = all
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);

  // Revenue by client
  const byClient: Record<string, number> = {};
  paid.forEach((i) => {
    byClient[i.client_name] = (byClient[i.client_name] || 0) + Number(i.amount);
  });
  const topClients = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // 6-month trend (mock + real)
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const trendData = [15000, 22000, 28000, 31000, 34000, Math.round(paidTotal / 1000) * 1000 || 38400];

  // By type (mock breakdown - would come from deliveries/invoices by category)
  const byType = [
    { label: "Retail", amount: 17300, color: "var(--gold)" },
    { label: "Designer", amount: 10800, color: "var(--pur)" },
    { label: "Hospitality", amount: 6900, color: "var(--grn)" },
    { label: "B2C Moves", amount: 3400, color: "var(--tx3)" },
  ];
  const maxByType = Math.max(...byType.map((t) => t.amount));

  const febRevenue = trendData[5];
  const ytd = trendData.reduce((a, b) => a + b, 0);
  const avgJob = paid.length > 0 ? Math.round(paidTotal / paid.length) : 2850;
  const pctChange = 23;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 animate-fade-up">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Feb Revenue</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">${(febRevenue / 1000).toFixed(1)}K</div>
          <div className="text-[10px] font-semibold text-[var(--grn)] mt-0.5">↑{pctChange}%</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">YTD</div>
          <div className="text-xl font-bold font-heading">${(ytd / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${(outstanding / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Avg Job</div>
          <div className="text-xl font-bold font-heading">${avgJob.toLocaleString()}</div>
        </Link>
      </div>

      {/* 6-Month Trend */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 mb-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">6-Month Trend</h3>
        <div className="flex items-end justify-between gap-2 h-[120px]">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-[var(--tx2)]">${(trendData[i] / 1000).toFixed(0)}K</span>
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${Math.max(12, (trendData[i] / 40000) * 100)}%`,
                  background: i === 5 ? "var(--gold)" : "var(--brd)",
                }}
              />
              <span className="text-[9px] text-[var(--tx3)]">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Type + Top Clients */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">By Type</h3>
          <div className="space-y-3">
            {byType.map((t) => (
              <div key={t.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] font-medium text-[var(--tx)]">{t.label}</span>
                  <span className="text-[11px] font-bold text-[var(--tx)]">${(t.amount / 1000).toFixed(1)}K</span>
                </div>
                <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(t.amount / maxByType) * 100}%`, background: t.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Top Clients</h3>
            <Link href="/admin/clients" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {topClients.length > 0 ? (
              topClients.map(([name, amount]) => (
                <Link
                  key={name}
                  href="/admin/clients"
                  className="flex items-center justify-between py-2 border-b border-[var(--brd)] last:border-0 hover:text-[var(--gold)] transition-colors"
                >
                  <span className="text-[11px] font-medium text-[var(--tx)]">{name}</span>
                  <span className="text-[11px] font-bold text-[var(--tx)]">${(amount / 1000).toFixed(1)}K</span>
                </Link>
              ))
            ) : (
              <div className="text-[11px] text-[var(--tx3)] py-4">No paid invoices yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
