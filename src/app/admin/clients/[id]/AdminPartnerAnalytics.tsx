"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useId,
  type CSSProperties,
} from "react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/format-currency";
import { getPartnerLabelsForPartner } from "@/utils/partnerType";
import { FOREST, WINE } from "@/app/quote/[quoteId]/quote-shared";

interface Props {
  orgId: string;
  orgName: string;
  /** Organizations.vertical or type — drives Move vs Delivery labels */
  partnerVertical?: string | null;
}

const CHART_COLORS = ["#2C3E2D", "#2D6A4F", "#5C1A33", "#4A7CE5", "#6B4C5A"];

const PERIOD_OPTIONS = [
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
  { value: 365, label: "1Y" },
];

const tooltipContentStyle: CSSProperties = {
  fontSize: 11,
  borderRadius: 6,
  border: "1px solid rgba(44, 62, 45, 0.12)",
  background: "#FFFFFF",
  boxShadow: "0 8px 24px rgba(44, 62, 45, 0.08)",
};

type MonthlyRow = { month: string; count: number; revenue: number; avgMoveValue: number };

function buildTrendRows(
  monthly: { month: string; count: number; revenue: number }[],
): MonthlyRow[] {
  return monthly.map((m) => ({
    ...m,
    avgMoveValue:
      m.count > 0 ? Math.round(m.revenue / m.count) : 0,
  }));
}

function PartnerTrendChart({
  title,
  dataKey,
  data,
  stroke,
  fillId,
  valueLabel,
  formatTick,
  formatTooltip,
}: {
  title: string;
  dataKey: keyof MonthlyRow;
  data: MonthlyRow[];
  stroke: string;
  fillId: string;
  valueLabel: string;
  formatTick: (v: number) => string;
  formatTooltip: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 min-w-0">
      <h4 className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-3 [font-family:var(--font-body)]">
        {title}
      </h4>
      <div className="h-[180px] w-full min-w-0">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-[var(--tx3)]">
            No data in range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(44, 62, 45, 0.08)"
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#5A6B5E" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#5A6B5E" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTick}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipContentStyle}
                formatter={(value) => [
                  formatTooltip(Number(value)),
                  valueLabel,
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey={dataKey as string}
                stroke={stroke}
                strokeWidth={2}
                fill={`url(#${fillId})`}
                dot={false}
                activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function AdminPartnerAnalytics({
  orgId,
  orgName,
  partnerVertical,
}: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
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
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [orgId, period]);

  useEffect(() => {
    load();
  }, [load]);

  const trendRows = useMemo(() => {
    if (!data) return [];
    const d = data as {
      monthlyVolume?: { month: string; count: number; revenue: number }[];
    };
    const mv = d.monthlyVolume ?? [];
    return buildTrendRows(mv);
  }, [data]);

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
    monthlyVolume: { month: string; count: number; revenue: number }[];
    zoneDistribution: { zone: string; count: number; pct: number }[];
    source?: string;
  };

  const pipe = (
    <span
      className="text-[var(--tx3)]/35 px-1 sm:px-2 select-none"
      aria-hidden
    >
      |
    </span>
  );

  return (
    <div className="space-y-6 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)]">
          {orgName}, {labels.analyticsTitle}
        </h3>
        <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--bg2)] border border-[var(--brd)]/50">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                period === opt.value
                  ? "bg-[var(--card)] text-[var(--tx)] shadow-sm border border-[var(--brd)]/60"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center justify-center sm:justify-start gap-y-2 py-4 border-y border-[var(--brd)]/50"
        role="group"
        aria-label="Partner performance summary"
      >
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] [font-family:var(--font-body)]">
            {labels.serviceUnitPlural}
          </span>
          <span className="font-hero text-[20px] sm:text-[24px] font-semibold tabular-nums text-[var(--tx)] leading-none">
            {d.totalDeliveries}
          </span>
        </span>
        {pipe}
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] [font-family:var(--font-body)]">
            Revenue
          </span>
          <span className="font-hero text-[20px] sm:text-[24px] font-semibold tabular-nums text-[#2C3E2D] leading-none">
            {formatCurrency(d.revenue)}
          </span>
        </span>
        {pipe}
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] [font-family:var(--font-body)]">
            {labels.avgMetric}
          </span>
          <span className="font-hero text-[20px] sm:text-[24px] font-semibold tabular-nums text-[var(--tx)] leading-none">
            {formatCurrency(d.avgRevenuePerDelivery)}
          </span>
        </span>
        {pipe}
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] [font-family:var(--font-body)]">
            On-time
          </span>
          <span className="font-hero text-[20px] sm:text-[24px] font-semibold tabular-nums text-emerald-600 leading-none">
            {d.onTimeRate}%
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PartnerTrendChart
          title={`${labels.volumeSeriesName} trend`}
          dataKey="count"
          data={trendRows}
          stroke={WINE}
          fillId={`${uid}moves`}
          valueLabel={labels.volumeSeriesName}
          formatTick={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
          formatTooltip={(v) => String(v)}
        />
        <PartnerTrendChart
          title="Revenue trend"
          dataKey="revenue"
          data={trendRows}
          stroke={FOREST}
          fillId={`${uid}rev`}
          valueLabel="Revenue"
          formatTick={(v) =>
            v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${v}`
          }
          formatTooltip={(v) => formatCurrency(v)}
        />
        <PartnerTrendChart
          title={`${labels.avgMetric} trend`}
          dataKey="avgMoveValue"
          data={trendRows}
          stroke="#6B4C5A"
          fillId={`${uid}avg`}
          valueLabel={labels.avgMetric}
          formatTick={(v) =>
            v >= 1000 ? `$${Math.round(v / 100) / 10}k` : `$${v}`
          }
          formatTooltip={(v) => formatCurrency(v)}
        />
      </div>

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
