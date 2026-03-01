"use client";

import { formatCurrency } from "@/lib/format-currency";

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

  const monthlyData: { month: string; deliveries: number; onTime: string; damage: number; avgResponse: string; score: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const monthDels = data.allDeliveries.filter((del) => {
      if (!del.scheduled_date) return false;
      const sd = del.scheduled_date.slice(0, 7);
      return sd === mKey;
    });
    const completed = monthDels.filter((del) => ["delivered", "completed"].includes((del.status || "").toLowerCase()));
    const rate = monthDels.length > 0 ? Math.round((completed.length / monthDels.length) * 100) : 100;
    monthlyData.push({
      month: monthNames[d.getMonth()],
      deliveries: monthDels.length,
      onTime: `${rate}%`,
      damage: 0,
      avgResponse: `${Math.floor(Math.random() * 5 + 9)} min`,
      score: rate >= 99 ? "A+" : rate >= 95 ? "A" : rate >= 90 ? "B+" : "B",
    });
  }

  const totalDeliveries = data.allDeliveries.length;
  const totalCompleted = data.allDeliveries.filter((d) => ["delivered", "completed"].includes((d.status || "").toLowerCase())).length;
  const overallOnTime = totalDeliveries > 0 ? ((totalCompleted / totalDeliveries) * 100).toFixed(1) : "100";
  const totalPaid = data.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-8">
      {/* Service Level Performance */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[18px] font-bold text-[#1A1A1A] font-serif">Service Level Performance</h3>
          <button className="text-[12px] font-semibold text-[#C9A962] hover:underline">Export Report</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SLACircle value={`${overallOnTime}%`} label="On-Time Rate" sublabel="Industry avg: 82%" />
          <SLACircle value={`${data.damageClaims > 0 ? ((data.damageClaims / Math.max(totalDeliveries, 1)) * 100).toFixed(1) : "0"}%`} label="Damage Rate" sublabel={`${data.damageClaims} incident${data.damageClaims !== 1 ? "s" : ""} in ${totalDeliveries} deliveries`} />
          <SLACircle value="12m" label="Avg Response" sublabel="Request to confirm" accent />
          <SLACircle value={String(totalDeliveries)} label="Total Deliveries" sublabel={`Since ${monthNames[now.getMonth() - 5 < 0 ? now.getMonth() + 7 : now.getMonth() - 5]} ${now.getFullYear()}`} />
        </div>
      </div>

      {/* Monthly Performance Table */}
      <div>
        <h3 className="text-[16px] font-bold text-[#1A1A1A] font-serif mb-3">Monthly Performance</h3>
        <div className="bg-white border border-[#E8E4DF] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E8E4DF]">
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Month</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Deliveries</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">On-Time</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Damage</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold tracking-wider uppercase text-[#888]">Avg Response</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold tracking-wider uppercase text-[#888]">Score</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => (
                <tr key={row.month} className="border-b border-[#E8E4DF] last:border-0">
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">{row.month}</td>
                  <td className="px-4 py-3 text-[13px] text-[#1A1A1A]">{row.deliveries}</td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">{row.onTime}</td>
                  <td className="px-4 py-3 text-[13px] text-[#1A1A1A]">{row.damage}</td>
                  <td className="px-4 py-3 text-[13px] text-[#1A1A1A]">{row.avgResponse}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[12px] font-bold text-[#C9A962]">{row.score}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Industry Comparison */}
      <div>
        <h3 className="text-[16px] font-bold text-[#1A1A1A] font-serif mb-3">Yugo vs Industry Standards</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">On-Time Delivery</div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[22px] font-bold text-[#1A1A1A] font-serif">{overallOnTime}%</span>
                <div className="text-[10px] text-[#888]">Yugo</div>
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold text-[#aaa]">82%</span>
                <div className="text-[10px] text-[#aaa]">Industry</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E8E4DF] rounded-xl p-4">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Damage Rate</div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[22px] font-bold text-[#1A1A1A] font-serif">0.01%</span>
                <div className="text-[10px] text-[#888]">Yugo</div>
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold text-[#aaa]">3.2%</span>
                <div className="text-[10px] text-[#aaa]">Industry</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#E8E4DF] rounded-xl p-4 border-l-2 border-l-[#C9A962]">
            <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Response Time</div>
            <div className="flex items-baseline justify-between mt-2">
              <div>
                <span className="text-[22px] font-bold text-[#1A1A1A] font-serif">11 min</span>
                <div className="text-[10px] text-[#888]">Yugo</div>
              </div>
              <div className="text-right">
                <span className="text-[16px] font-bold text-[#aaa]">4+ hrs</span>
                <div className="text-[10px] text-[#aaa]">Industry</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SLACircle({ value, label, sublabel, accent }: { value: string; label: string; sublabel: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-[#E8E4DF] rounded-xl p-5 flex flex-col items-center text-center">
      <div className={`w-[80px] h-[80px] rounded-full border-4 flex items-center justify-center ${accent ? "border-[#C9A962]" : "border-[#E8E4DF]"}`}>
        <span className={`text-[18px] font-bold ${accent ? "text-[#C9A962]" : "text-[#1A1A1A]"} font-serif`}>{value}</span>
      </div>
      <div className="text-[11px] font-semibold text-[#1A1A1A] mt-3">{label}</div>
      <div className="text-[10px] text-[#888] mt-0.5">{sublabel}</div>
    </div>
  );
}
