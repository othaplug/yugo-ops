"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/format-currency";
import { getPartnerLabelsForPartner } from "@/utils/partnerType";

interface Props {
  orgId: string;
  orgName: string;
  /** Organizations.vertical or type — drives Move vs Delivery labels */
  partnerVertical?: string | null;
}

const GOLD = "#2C3E2D";
const CHART_COLORS = ["#2C3E2D", "#2D6A4F", "#2C3E2D", "#4A7CE5", "#D48A29"];

const PERIOD_OPTIONS = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1Y" },
];

export default function AdminPartnerAnalytics({
  orgId,
  orgName,
  partnerVertical,
}: Props) {
  const [period, setPeriod] = useState(90);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const labels = useMemo(
    () =>
      getPartnerLabelsForPartner({
        vertical: partnerVertical,
        type: partnerVertical,
      }),
    [partnerVertical],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/partners/${orgId}/analytics?period=${period}`,
      );
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, [orgId, period]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--gold)]/30 border-t-[var(--gold)] animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-[var(--tx3)] text-[13px]">
        No analytics data available.
      </div>
    );
  }

  const d = data as {
    totalDeliveries: number;
    revenue: number;
    avgRevenuePerDelivery: number;
    onTimeRate: number;
    satisfactionScore: number | null;
    damageRate: number;
    monthlyVolume: { month: string; count: number; revenue: number }[];
    zoneDistribution: { zone: string; count: number; pct: number }[];
    source?: string;
  };

  return (
    <div className="space-y-6 py-5">
      {/* Period toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)]">
          {orgName}, {labels.analyticsTitle}
        </h3>
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg)]">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                period === opt.value
                  ? "bg-[var(--card)] text-[var(--tx)] shadow-sm"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            {labels.serviceUnitPlural}
          </div>
          <div className="text-[20px] font-bold text-[var(--tx)] mt-0.5">
            {d.totalDeliveries}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            Revenue
          </div>
          <div className="text-[20px] font-bold text-[var(--gold)] mt-0.5">
            {formatCurrency(d.revenue)}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            {labels.avgMetric}
          </div>
          <div className="text-[20px] font-bold text-[var(--tx)] mt-0.5">
            {formatCurrency(d.avgRevenuePerDelivery)}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            On-Time
          </div>
          <div className="text-[20px] font-bold text-emerald-500 mt-0.5">
            {d.onTimeRate}%
          </div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            Satisfaction
          </div>
          <div className="text-[20px] font-bold text-[var(--gold)] mt-0.5">
            {d.satisfactionScore != null ? `${d.satisfactionScore}/5` : "-"}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/82">
            Damage
          </div>
          <div
            className="text-[20px] font-bold mt-0.5"
            style={{ color: d.damageRate <= 1 ? "#22C55E" : "#EF4444" }}
          >
            {d.damageRate}%
          </div>
        </div>
      </div>

      {/* Volume + Revenue Chart */}
      {d.monthlyVolume && d.monthlyVolume.length > 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
          <h4 className="text-[12px] font-bold text-[var(--tx)] mb-3">
            Monthly Volume & Revenue
          </h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.monthlyVolume}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 9, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 9, fill: "#888" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid #E8E4DC",
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  fill={GOLD}
                  radius={[3, 3, 0, 0]}
                  name={labels.volumeSeriesName}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2D6A4F"
                  strokeWidth={2}
                  dot={false}
                  name="Revenue"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Zone Distribution */}
      {d.zoneDistribution && d.zoneDistribution.length > 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
          <h4 className="text-[12px] font-bold text-[var(--tx)] mb-3">
            {d.source === "moves" ? "Area / zone mix" : "Zone distribution"}
          </h4>
          <div className="flex items-center gap-6">
            <div className="h-[150px] w-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={d.zoneDistribution}
                    dataKey="count"
                    nameKey="zone"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={3}
                  >
                    {d.zoneDistribution.map((_e, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {d.zoneDistribution.map((z, i) => (
                <div
                  key={z.zone}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-[var(--tx)]">{z.zone}</span>
                  <span className="text-[var(--tx3)]">{z.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
