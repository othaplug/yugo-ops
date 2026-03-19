"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCurrency } from "@/lib/format-currency";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  Users,
  Sun,
  BarChart3,
} from "lucide-react";
import BackButton from "../../components/BackButton";

/* ════════════ Types ════════════ */

interface Pipeline {
  confirmed: { total: number; moveCount: number; moveRevenue: number; deliveryCount: number; deliveryRevenue: number };
  projected: { total: number; quoteCount: number; quoteRevenue: number; partnerRequestCount: number; partnerRevenue: number; highProb: number; midProb: number; lowProb: number };
  potential: { total: number; leadCount: number; rawEstimate: number };
}

interface DailyRevenue {
  date: string;
  label: string;
  dayLabel: string;
  residential: number;
  b2b: number;
  projected: number;
  isToday: boolean;
}

interface CapacityDay {
  date: string;
  dayLabel: string;
  booked: number;
  total: number;
  pct: number;
  moveCount: number;
  deliveryCount: number;
  details: string;
}

interface SeasonalMonth {
  month: string;
  label: string;
  multiplier: number;
  isCurrent: boolean;
}

interface MetricPair {
  thisMonth: number;
  lastMonth: number | null;
  change: number | null;
}

interface ForecastData {
  pipeline: Pipeline;
  dailyRevenue: DailyRevenue[];
  capacity: CapacityDay[];
  seasonal: SeasonalMonth[];
  seasonalTip: string | null;
  metrics: {
    confirmedRevenue: MetricPair;
    b2bRevenue: MetricPair;
    avgDaysToBook: MetricPair;
    conversionRate: MetricPair;
    widgetLeads: MetricPair;
    capacityUtilization: MetricPair;
    openClaims: MetricPair;
  };
}

/* ════════════ Constants ════════════ */

const RANGES = [
  { id: "7", label: "7d" },
  { id: "14", label: "14d" },
  { id: "30", label: "30d" },
  { id: "90", label: "90d" },
];

/* ════════════ Main Component ════════════ */

export default function ForecastClient() {
  const [range, setRange] = useState("30");
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/finance/forecast?range=${range}`);
      if (!res.ok) throw new Error("fetch failed");
      setData(await res.json());
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="h-7 w-48 animate-pulse rounded bg-[var(--brd)]/30" />
          <div className="h-8 w-52 animate-pulse rounded-lg bg-[var(--brd)]/30" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-[var(--brd)]/20" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-[var(--brd)]/20" />
        <div className="h-64 animate-pulse rounded-xl bg-[var(--brd)]/20" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10 text-center text-[var(--tx3)] text-[13px]">
        Failed to load forecast data. Please try again.
      </div>
    );
  }

  const { pipeline, dailyRevenue, capacity, seasonal, seasonalTip, metrics } = data;
  const totalPipeline = pipeline.confirmed.total + pipeline.projected.total + pipeline.potential.total;
  const hasFullDays = capacity.some((d) => d.pct >= 100);
  const hasLowDays = capacity.some((d) => d.pct > 0 && d.pct < 30);

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Profitability" href="/admin/finance/profitability" /></div>
      {/* ──── HEADER ──── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Finance</p>
          <h1 className="font-heading text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Revenue Forecast</h1>
          <p className="text-[11px] text-[var(--tx3)] mt-2">Pipeline, capacity &amp; revenue projections</p>
        </div>
        <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2 py-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                range === r.id
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ SECTION 1: REVENUE PIPELINE ══════════ */}
      <Section title="Revenue Pipeline" icon={<BarChart3 className="w-4 h-4" />}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Confirmed */}
          <PipelineCard
            label="CONFIRMED"
            total={pipeline.confirmed.total}
            color="text-emerald-400"
            bgClass="bg-emerald-500/5 border-emerald-500/20"
          >
            <div className="space-y-0.5 mt-2 text-[10px] text-[var(--tx3)]">
              <div>
                {pipeline.confirmed.moveCount} move{pipeline.confirmed.moveCount !== 1 ? "s" : ""}
              </div>
              <div>
                {pipeline.confirmed.deliveryCount} deliver{pipeline.confirmed.deliveryCount !== 1 ? "ies" : "y"}
              </div>
            </div>
          </PipelineCard>

          {/* Projected */}
          <PipelineCard
            label="PROJECTED"
            total={pipeline.projected.total}
            color="text-[var(--gold)]"
            bgClass="bg-[var(--gold)]/5 border-[var(--gold)]/20"
          >
            <div className="space-y-0.5 mt-2 text-[10px] text-[var(--tx3)]">
              <div>
                {pipeline.projected.quoteCount} quote{pipeline.projected.quoteCount !== 1 ? "s" : ""} (weighted)
              </div>
              {pipeline.projected.partnerRequestCount > 0 && (
                <div>
                  {pipeline.projected.partnerRequestCount} partner request
                  {pipeline.projected.partnerRequestCount !== 1 ? "s" : ""}
                </div>
              )}
              {pipeline.projected.highProb > 0 && (
                <div className="text-emerald-400/80">
                  {pipeline.projected.highProb} at 60% likely
                </div>
              )}
              {pipeline.projected.midProb > 0 && (
                <div className="text-[var(--gold)]/80">
                  {pipeline.projected.midProb} at 30% likely
                </div>
              )}
            </div>
          </PipelineCard>

          {/* Potential */}
          <PipelineCard
            label="POTENTIAL"
            total={pipeline.potential.total}
            color="text-[var(--tx2)]"
            bgClass="bg-[var(--bg)]/50 border-[var(--brd)]"
          >
            <div className="space-y-0.5 mt-2 text-[10px] text-[var(--tx3)]">
              <div>
                {pipeline.potential.leadCount} widget lead{pipeline.potential.leadCount !== 1 ? "s" : ""} not yet quoted
              </div>
              <div className="opacity-60">
                est. {formatCurrency(pipeline.potential.rawEstimate)} at 30% conv.
              </div>
            </div>
          </PipelineCard>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--brd)]/30 flex items-center justify-between">
          <span className="text-[10px] text-[var(--tx3)]">Total pipeline value</span>
          <span className="text-[14px] font-heading font-bold text-[var(--tx)]">
            {formatCurrency(totalPipeline)}
          </span>
        </div>
      </Section>

      {/* ══════════ SECTION 2: DAILY REVENUE CHART ══════════ */}
      <Section title="Daily Revenue" icon={<Calendar className="w-4 h-4" />}>
        {dailyRevenue.length > 0 ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: "var(--tx3)" }}
                    axisLine={false}
                    tickLine={false}
                    interval={
                      dailyRevenue.length > 30
                        ? Math.floor(dailyRevenue.length / 12)
                        : dailyRevenue.length > 14
                          ? 1
                          : 0
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--tx3)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`)}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--brd)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(value, name) => [
                      formatCurrency(typeof value === "number" ? value : 0),
                      name === "residential" ? "Residential" : name === "b2b" ? "B2B Delivery" : "Projected",
                    ]}
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as DailyRevenue | undefined;
                      return item ? `${item.dayLabel}, ${item.label}${item.isToday ? " (Today)" : ""}` : "";
                    }}
                    cursor={{ fill: "rgba(201,169,98,0.06)" }}
                  />
                  <Bar dataKey="residential" stackId="a" fill="#C9A962" name="residential" />
                  <Bar dataKey="b2b" stackId="a" fill="#2D6A4F" name="b2b" />
                  <Bar
                    dataKey="projected"
                    stackId="a"
                    fill="rgba(201,169,98,0.3)"
                    radius={[2, 2, 0, 0]}
                    name="projected"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--tx3)]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#C9A962]" />
                Residential
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#2D6A4F]" />
                B2B Delivery
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#C9A962]/30 border border-[#C9A962]/40" />
                Projected
              </span>
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-[13px] text-[var(--tx3)]">
            No revenue data for the selected range.
          </div>
        )}
      </Section>

      {/* ══════════ SECTION 3: CAPACITY UTILIZATION ══════════ */}
      <Section title="Crew Capacity (Next 7 Days)" icon={<Users className="w-4 h-4" />}>
        <div className="space-y-2">
          {capacity.map((day) => (
            <CapacityRow key={day.date} day={day} />
          ))}
        </div>

        {hasFullDays && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            One or more days are at full capacity. No more bookings can be accepted unless you add crew.
          </div>
        )}
        {hasLowDays && !hasFullDays && (
          <div className="mt-4 p-3 rounded-lg bg-[var(--gold)]/5 border border-[var(--gold)]/20 text-[11px] text-[var(--tx2)]">
            Low utilization on some days — consider marketing push or partner outreach.
          </div>
        )}
      </Section>

      {/* ══════════ SECTION 4: SEASONAL INTELLIGENCE ══════════ */}
      <Section title="Seasonal Trends" icon={<Sun className="w-4 h-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {seasonal.map((s) => (
            <div
              key={s.month}
              className={`rounded-lg border p-3 transition-colors ${
                s.isCurrent
                  ? "border-[var(--gold)]/40 bg-[var(--gold)]/5"
                  : "border-[var(--brd)] bg-[var(--bg)]/50"
              }`}
            >
              <div className="text-[11px] font-bold text-[var(--tx)]">
                {s.month}
                {s.isCurrent && (
                  <span className="ml-1.5 text-[8px] bg-[var(--gold)]/20 text-[var(--gold)] px-1.5 py-0.5 rounded-full font-semibold">
                    NOW
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                {s.label} (&times;{s.multiplier.toFixed(2)})
              </div>
            </div>
          ))}
        </div>
        {seasonalTip && (
          <div className="mt-3 p-3 rounded-lg bg-[var(--gold)]/5 border border-[var(--gold)]/20 text-[11px] text-[var(--tx2)] leading-relaxed">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--gold)] inline mr-1.5 -mt-0.5" />
            {seasonalTip}
          </div>
        )}
      </Section>

      {/* ══════════ SECTION 5: KEY METRICS TABLE ══════════ */}
      <Section title="Key Metrics">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">
                  Metric
                </th>
                <th className="text-right text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">
                  This Month
                </th>
                <th className="text-right text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">
                  Last Month
                </th>
                <th className="text-right text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              <MetricRow
                label="Confirmed revenue"
                thisMonth={formatCurrency(metrics.confirmedRevenue.thisMonth)}
                lastMonth={formatCurrency(metrics.confirmedRevenue.lastMonth ?? 0)}
                change={metrics.confirmedRevenue.change}
              />
              <MetricRow
                label="B2B delivery revenue"
                thisMonth={formatCurrency(metrics.b2bRevenue.thisMonth)}
                lastMonth={formatCurrency(metrics.b2bRevenue.lastMonth ?? 0)}
                change={metrics.b2bRevenue.change}
              />
              <MetricRow
                label="Avg days from quote to book"
                thisMonth={metrics.avgDaysToBook.thisMonth > 0 ? `${metrics.avgDaysToBook.thisMonth} days` : "—"}
                lastMonth={
                  metrics.avgDaysToBook.lastMonth != null && metrics.avgDaysToBook.lastMonth > 0
                    ? `${metrics.avgDaysToBook.lastMonth} days`
                    : "—"
                }
                change={metrics.avgDaysToBook.change}
                invertColor
              />
              <MetricRow
                label="Quote conversion rate"
                thisMonth={`${metrics.conversionRate.thisMonth}%`}
                lastMonth={`${metrics.conversionRate.lastMonth ?? 0}%`}
                change={metrics.conversionRate.change}
              />
              <MetricRow
                label="Widget leads captured"
                thisMonth={String(metrics.widgetLeads.thisMonth)}
                lastMonth={metrics.widgetLeads.lastMonth != null ? String(metrics.widgetLeads.lastMonth) : "N/A"}
                change={metrics.widgetLeads.change}
                isNew={metrics.widgetLeads.lastMonth == null}
              />
              <MetricRow
                label="Capacity utilization"
                thisMonth={`${metrics.capacityUtilization.thisMonth}%`}
                lastMonth={`${metrics.capacityUtilization.lastMonth ?? 0}%`}
                change={metrics.capacityUtilization.change}
              />
              <MetricRow
                label="Open claims value"
                thisMonth={formatCurrency(metrics.openClaims.thisMonth)}
                lastMonth={formatCurrency(metrics.openClaims.lastMonth ?? 0)}
                change={metrics.openClaims.change}
              />
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ════════════ Sub-Components ════════════ */

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-[var(--tx3)]">{icon}</span>}
        <h2 className="text-[13px] font-bold text-[var(--tx)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function PipelineCard({
  label,
  total,
  color,
  bgClass,
  children,
}: {
  label: string;
  total: number;
  color: string;
  bgClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${bgClass}`}>
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60 mb-1">{label}</div>
      <div className={`text-2xl font-heading font-bold ${color}`}>{formatCurrency(total)}</div>
      {children}
    </div>
  );
}

function CapacityRow({ day }: { day: CapacityDay }) {
  const isFull = day.pct >= 100;

  const barColor = isFull
    ? "bg-red-500"
    : day.pct >= 70
      ? "bg-[var(--gold)]"
      : day.pct >= 30
        ? "bg-emerald-500"
        : day.pct > 0
          ? "bg-[var(--tx3)]/30"
          : "bg-transparent";

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[11px] font-mono font-medium text-[var(--tx2)] w-8 shrink-0">{day.dayLabel}</span>
      <div className="flex-1 h-5 bg-[var(--bg)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(day.pct, day.pct > 0 ? 3 : 0)}%` }}
        />
      </div>
      <span className={`text-[11px] font-bold w-10 text-right ${isFull ? "text-red-400" : "text-[var(--tx2)]"}`}>
        {day.pct}%
      </span>
      <span className="text-[10px] text-[var(--tx3)] min-w-[140px] truncate hidden sm:inline">
        {day.details}
        {isFull && " \u26A0\uFE0F FULL"}
      </span>
    </div>
  );
}

function MetricRow({
  label,
  thisMonth,
  lastMonth,
  change,
  invertColor = false,
  isNew = false,
}: {
  label: string;
  thisMonth: string;
  lastMonth: string;
  change: number | null;
  invertColor?: boolean;
  isNew?: boolean;
}) {
  let changeDisplay = "\u2014";
  let changeColor = "text-[var(--tx3)]";

  if (isNew) {
    changeDisplay = "New";
    changeColor = "text-[var(--gold)]";
  } else if (change != null) {
    const isPositive = invertColor ? change < 0 : change > 0;
    changeDisplay = `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
    changeColor = isPositive ? "text-emerald-400" : change === 0 ? "text-[var(--tx3)]" : "text-red-400";
  }

  return (
    <tr className="border-t border-[var(--brd)]/50">
      <td className="py-2 px-2 font-medium text-[var(--tx)]">{label}</td>
      <td className="py-2 px-2 text-right font-bold text-[var(--tx)]">{thisMonth}</td>
      <td className="py-2 px-2 text-right text-[var(--tx3)]">{lastMonth}</td>
      <td className={`py-2 px-2 text-right font-semibold ${changeColor}`}>{changeDisplay}</td>
    </tr>
  );
}
