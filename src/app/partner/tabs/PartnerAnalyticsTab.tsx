"use client";

import { useState, useEffect, useCallback } from "react";
import { Star } from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface Props {
  orgId: string;
  orgName: string;
}

interface AnalyticsData {
  onTimeRate: number;
  satisfactionScore: number | null;
  satisfactionCount: number;
  damageRate: number;
  avgDeliveryMinutes: number;
  monthlyVolume: { month: string; count: number }[];
  monthlyCost: { month: string; avgCost: number }[];
  zoneDistribution: { zone: string; count: number; pct: number }[];
  ratingDistribution: { stars: number; count: number }[];
  recentComments: { name: string; date: string; rating: number; comment: string }[];
  recentDeliveries: {
    date: string;
    type: string;
    zone: number;
    minutes: number;
    onTime: boolean;
    rating: number | null;
    hasDamage: boolean;
  }[];
}

const PERIOD_OPTIONS = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
];

const GOLD = "#C9A962";
const CHART_COLORS = ["#C9A962", "#2D6A4F", "#5C1A33", "#4A7CE5", "#D48A29"];

function KPICard({ label, value, sublabel, accent }: { label: string; value: string; sublabel?: string; accent?: string }) {
  return (
    <div className="p-4 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60 mb-1">{label}</div>
      <div className="text-[24px] font-bold font-hero" style={{ color: accent || "var(--tx)" }}>{value}</div>
      {sublabel && <div className="text-[10px] text-[var(--tx3)] mt-0.5">{sublabel}</div>}
    </div>
  );
}

export default function PartnerAnalyticsTab({ orgId, orgName }: Props) {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partner/analytics?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 rounded-full border-2 border-[#C9A962]/30 border-t-[#C9A962] animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-16 text-[var(--tx3)] text-[13px]">Unable to load analytics data.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-[24px] font-bold font-hero text-[var(--tx)]">Performance Analytics</h2>
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg)]">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                period === opt.value ? "bg-[var(--card)] text-[var(--tx)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="On-Time Rate" value={`${data.onTimeRate}%`} sublabel="Within scheduled window" accent="#22C55E" />
        <KPICard
          label="Satisfaction"
          value={data.satisfactionScore != null ? `${data.satisfactionScore.toFixed(1)}/5` : "Collecting data"}
          sublabel={data.satisfactionScore != null ? `${data.satisfactionCount} ratings` : data.satisfactionCount > 0 ? `${data.satisfactionCount} of 5 ratings` : "Need ratings from completed deliveries"}
          accent={GOLD}
        />
        <KPICard label="Damage Rate" value={`${data.damageRate}%`} sublabel="Industry avg: 3-5%" accent={data.damageRate <= 1 ? "#22C55E" : "#EF4444"} />
        <KPICard label="Avg Delivery" value={data.avgDeliveryMinutes > 0 ? `${data.avgDeliveryMinutes}m` : "—"} sublabel="Average delivery time" />
      </div>

      {/* Delivery Volume Trend */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
        <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Delivery Volume (Last 12 Months)</h3>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyVolume}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E4DC" }} />
              <Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} name="Deliveries" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost Analysis */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
        <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Average Cost per Delivery</h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyCost}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E4DC" }} formatter={(v) => [`$${v ?? 0}`, "Avg Cost"]} />
              <Line type="monotone" dataKey="avgCost" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Zone Distribution */}
        <div>
          <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Zone Distribution</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.zoneDistribution}
                  dataKey="count"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {data.zoneDistribution.map((_entry, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E4DC" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {data.zoneDistribution.map((z, i) => (
              <div key={z.zone} className="flex items-center gap-1.5 text-[10px] text-[var(--tx3)]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                {z.zone} ({z.pct}%)
              </div>
            ))}
          </div>
        </div>

        {/* Satisfaction Breakdown */}
        <div>
          <h3 className="text-[13px] font-bold text-[var(--tx)] mb-4">Satisfaction Breakdown</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ratingDistribution} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stars" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} star${v === 1 ? "" : "s"}`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E4DC" }} />
                <Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} name="Ratings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Comments */}
      {data.recentComments.length > 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
          <h3 className="text-[13px] font-bold text-[var(--tx)] mb-3">Recent Customer Comments</h3>
          <div className="space-y-3">
            {data.recentComments.map((c, i) => (
              <div key={i} className={`py-3 ${i > 0 ? "border-t border-[var(--brd)]/30" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--tx)]">{c.name}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={10} color={GOLD} weight={n <= c.rating ? "fill" : "regular"} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--tx3)]">{c.date}</span>
                </div>
                <p className="text-[12px] text-[var(--tx2)] italic">&ldquo;{c.comment}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Delivery Performance */}
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 overflow-x-auto">
        <h3 className="text-[13px] font-bold text-[var(--tx)] mb-3">Delivery Performance</h3>
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]">
              <th className="pb-2 pr-3">Date</th>
              <th className="pb-2 pr-3">Type</th>
              <th className="pb-2 pr-3">Zone</th>
              <th className="pb-2 pr-3">Time</th>
              <th className="pb-2 pr-3">On-Time</th>
              <th className="pb-2 pr-3">Rating</th>
              <th className="pb-2">Damage</th>
            </tr>
          </thead>
          <tbody>
            {data.recentDeliveries.map((d, i) => (
              <tr key={i} className="border-t border-[var(--brd)]/20">
                <td className="py-2 pr-3 text-[var(--tx)]">{d.date}</td>
                <td className="py-2 pr-3 text-[var(--tx3)]">{d.type}</td>
                <td className="py-2 pr-3 text-[var(--tx3)]">Z{d.zone}</td>
                <td className="py-2 pr-3 text-[var(--tx3)]">{d.minutes}m</td>
                <td className="py-2 pr-3">
                  <span className={d.onTime ? "text-emerald-500" : "text-red-500"}>{d.onTime ? "Yes" : "No"}</span>
                </td>
                <td className="py-2 pr-3 text-[var(--tx3)]">{d.rating ? `${d.rating} stars` : "—"}</td>
                <td className="py-2">
                  <span className={d.hasDamage ? "text-red-500" : "text-emerald-500"}>{d.hasDamage ? "Yes" : "No"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
