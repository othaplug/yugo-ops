"use client";

import { formatCurrency } from "@/lib/format-currency";
import YugoLogo from "@/components/YugoLogo";

interface DashboardData {
  completedThisMonth: number;
  onTimeRate: number;
  damageClaims: number;
  outstandingAmount: number;
  allDeliveries: { id: string; status: string; scheduled_date: string | null }[];
  invoices: { id: string; amount: number; status: string; created_at: string }[];
}

export default function PartnerBillingTab({ data, orgName }: { data: DashboardData; orgName: string }) {
  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyData: { month: string; deliveries: number; completed: number; onTime: string; damage: number; score: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthDels = data.allDeliveries.filter((del) => {
      if (!del.scheduled_date) return false;
      return del.scheduled_date.slice(0, 7) === mKey;
    });
    const completed = monthDels.filter((del) => ["delivered", "completed"].includes((del.status || "").toLowerCase()));
    const rate = monthDels.length > 0 ? Math.round((completed.length / monthDels.length) * 100) : 100;
    monthlyData.push({
      month: monthNames[d.getMonth()],
      deliveries: monthDels.length,
      completed: completed.length,
      onTime: `${rate}%`,
      damage: 0,
      score: rate >= 99 ? "A+" : rate >= 95 ? "A" : rate >= 90 ? "B+" : "B",
    });
  }

  const totalDeliveries = data.allDeliveries.length;
  const totalCompleted = data.allDeliveries.filter((d) => ["delivered", "completed"].includes((d.status || "").toLowerCase())).length;
  const overallOnTime = totalDeliveries > 0 ? ((totalCompleted / totalDeliveries) * 100).toFixed(1) : "100";
  const totalPaid = data.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  const totalRevenue = data.invoices.reduce((s, i) => s + Number(i.amount), 0);

  const exportReport = () => {
    const rows = [["Month", "Deliveries", "Completed", "On-Time %", "Damage Claims", "Score"]];
    monthlyData.forEach((row) => {
      rows.push([row.month, String(row.deliveries), String(row.completed), row.onTime, String(row.damage), row.score]);
    });
    rows.push([]);
    rows.push(["Summary"]);
    rows.push(["Total Deliveries", String(totalDeliveries)]);
    rows.push(["On-Time Rate", `${overallOnTime}%`]);
    rows.push(["Total Revenue", String(totalRevenue)]);
    rows.push(["Total Paid", String(totalPaid)]);
    rows.push(["Outstanding", String(data.outstandingAmount)]);

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-report-${orgName.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Service Level Performance */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-h1 font-bold text-[var(--tx)] font-hero">Service Level Performance</h3>
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-1.5 text-ui font-semibold text-[#C9A962] hover:text-[#8B6914] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export Report
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SLACircle value={`${overallOnTime}%`} label="On-Time Rate" sublabel="Industry avg: 82%" />
          <SLACircle value={`${data.damageClaims > 0 ? ((data.damageClaims / Math.max(totalDeliveries, 1)) * 100).toFixed(1) : "0"}%`} label="Damage Rate" sublabel={`${data.damageClaims} incident${data.damageClaims !== 1 ? "s" : ""} in ${totalDeliveries} deliveries`} />
          <SLACircle value={formatCurrency(totalPaid)} label="Total Paid" sublabel={`of ${formatCurrency(totalRevenue)} billed`} accent />
          <SLACircle value={String(totalDeliveries)} label="Total Deliveries" sublabel={`${totalCompleted} completed`} />
        </div>
      </div>

      {/* Monthly Performance Table */}
      <div>
        <h3 className="text-h1 font-bold text-[var(--tx)] font-hero mb-3">Monthly Performance</h3>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--brd)]">
                  <th className="px-4 py-3 text-left text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Month</th>
                  <th className="px-4 py-3 text-left text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Deliveries</th>
                  <th className="px-4 py-3 text-left text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Completed</th>
                  <th className="px-4 py-3 text-left text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">On-Time</th>
                  <th className="px-4 py-3 text-left text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Damage</th>
                  <th className="px-4 py-3 text-right text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Score</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row) => (
                  <tr key={row.month} className="border-b border-[var(--brd)] last:border-0">
                    <td className="px-4 py-3 text-body font-semibold text-[var(--tx)]">{row.month}</td>
                    <td className="px-4 py-3 text-body text-[var(--tx)]">{row.deliveries}</td>
                    <td className="px-4 py-3 text-body text-[var(--tx)]">{row.completed}</td>
                    <td className="px-4 py-3 text-body font-semibold text-[var(--tx)]">{row.onTime}</td>
                    <td className="px-4 py-3 text-body text-[var(--tx)]">{row.damage}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-ui font-bold ${row.score.startsWith("A") ? "text-[#2D9F5A]" : "text-[var(--gold)]"}`}>{row.score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Industry Comparison */}
      <div>
        <h3 className="text-h1 font-bold text-[var(--tx)] font-hero mb-3 flex items-center gap-2">
          <YugoLogo size={18} variant="black" />
          <span>vs Industry Standards</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ComparisonCard label="On-Time Delivery" yugoValue={`${overallOnTime}%`} industryValue="82%" />
          <ComparisonCard
            label="Damage Rate"
            yugoValue={`${data.damageClaims > 0 ? ((data.damageClaims / Math.max(totalDeliveries, 1)) * 100).toFixed(2) : "0"}%`}
            industryValue="3.2%"
          />
          <ComparisonCard label="Response Time" yugoValue="< 15 min" industryValue="4+ hrs" accent />
        </div>
      </div>

      {/* Revenue breakdown */}
      <div>
        <h3 className="text-h1 font-bold text-[var(--tx)] font-hero mb-3">Revenue Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Total Billed</div>
            <div className="text-hero font-bold text-[var(--tx)] mt-1 font-hero">{formatCurrency(totalRevenue)}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Paid</div>
            <div className="text-hero font-bold text-[#2D9F5A] mt-1 font-hero">{formatCurrency(totalPaid)}</div>
          </div>
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
            <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">Outstanding</div>
            <div className="text-hero font-bold text-[var(--red)] mt-1 font-hero">{formatCurrency(data.outstandingAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SLACircle({ value, label, sublabel, accent }: { value: string; label: string; sublabel: string; accent?: boolean }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 flex flex-col items-center text-center">
      <div className={`w-[80px] h-[80px] rounded-full border-4 flex items-center justify-center ${accent ? "border-[var(--gold)]" : "border-[var(--brd)]"}`}>
        <span className={`text-h1 font-bold ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"} font-hero`}>{value}</span>
      </div>
      <div className="text-caption font-semibold text-[var(--tx)] mt-3">{label}</div>
      <div className="text-label text-[var(--tx3)] mt-0.5">{sublabel}</div>
    </div>
  );
}

function ComparisonCard({ label, yugoValue, industryValue, accent }: { label: string; yugoValue: string; industryValue: string; accent?: boolean }) {
  return (
    <div className={`bg-[var(--card)] border rounded-xl p-4 ${accent ? "border-l-2 border-l-[var(--gold)] border-[var(--brd)]" : "border-[var(--brd)]"}`}>
      <div className="text-label font-semibold tracking-wider uppercase text-[var(--tx3)]">{label}</div>
      <div className="flex items-baseline justify-between mt-2">
        <div>
          <span className="text-hero font-bold text-[var(--tx)] font-hero">{yugoValue}</span>
          <div className="mt-0.5 flex items-center">
            <YugoLogo size={12} variant="black" />
          </div>
        </div>
        <div className="text-right">
          <span className="text-h3 font-bold text-[var(--tx3)]">{industryValue}</span>
          <div className="text-label text-[var(--tx3)]">Industry</div>
        </div>
      </div>
    </div>
  );
}
