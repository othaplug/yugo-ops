"use client";

import { useState, useEffect, useCallback } from "react";
import { Star } from "@phosphor-icons/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { FOREST, WINE } from "@/app/quote/[quoteId]/quote-shared";
import { PartnerPageTitle, PartnerSectionEyebrow } from "@/components/partner/PartnerChrome";
import {
  pmBodyMuted,
  pmLabelCaps,
  pmLeadTitle,
  pmSectionTitle,
} from "@/components/partner/pm/pm-typography";
import { InfoHint } from "@/components/ui/InfoHint";
import { PartnerPmMoveHistoryTab } from "@/components/partner/pm/PartnerPmPortalViews";

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
    zone: string;
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

const CHART_ZONE_COLORS = [WINE, FOREST, "#6B4C5A", "#4F6B52", "#8E7A82"];

const tooltipStyle = {
  fontSize: 11,
  borderRadius: 2,
  border: "1px solid rgba(44, 62, 45, 0.12)",
  background: "#FFFBF7",
  boxShadow: "0 8px 24px rgba(44, 62, 45, 0.08)",
};

const axisTick = { fontSize: 10, fill: "#5A6B5E" };

const SUBTAB_BTN =
  "shrink-0 px-3 sm:px-4 py-3 text-[10px] font-bold tracking-[0.12em] uppercase whitespace-nowrap border-b transition-colors -mb-px min-w-[5rem] [font-family:var(--font-body)]";

function PartnerPmInsightsBody({ data }: { data: AnalyticsData }) {
  const hasData =
    (data.monthlyVolume?.some((m) => m.count > 0) ?? false) ||
    (data.recentDeliveries?.length ?? 0) > 0 ||
    (data.monthlyCost?.some((m) => m.avgCost > 0) ?? false);

  if (!hasData) {
    return (
      <div className="space-y-8 pt-6">
        <div className="text-center max-w-xl mx-auto px-1">
          <h3 className={`${pmLeadTitle} mb-3`}>Analytics will appear here</h3>
          <p className={pmBodyMuted}>
            Once you have completed moves, this page will show move volume trends, spend by building, cost breakdowns by move
            type, and performance metrics over time.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {[
            { label: "Move volume", desc: "Monthly trend of completed moves" },
            { label: "Spend by building", desc: "Which buildings drive the most volume" },
            { label: "Move type breakdown", desc: "Distribution of move types over time" },
          ].map((metric) => (
            <div key={metric.label} className="space-y-3">
              <p className={pmLabelCaps}>{metric.label}</p>
              <p className={`text-[11px] leading-relaxed text-[#5A6B5E] [font-family:var(--font-body)]`}>{metric.desc}</p>
              <div className="h-20 mt-2 border-b border-[#2C3E2D]/15 flex items-end justify-center pb-2">
                <p className={`${pmLabelCaps} opacity-80`}>Preview</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
        <PartnerSectionEyebrow>Volume</PartnerSectionEyebrow>
        <div className="mb-5 flex items-center gap-2">
          <h3 className={pmSectionTitle}>Move volume</h3>
          <InfoHint ariaLabel="Chart scope" className="shrink-0">
            Last 12 months of move volume on your contract.
          </InfoHint>
        </div>
        <div className="h-[220px] w-full min-w-0 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.monthlyVolume} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill={WINE} radius={[1, 1, 0, 0]} name="Moves" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
        <PartnerSectionEyebrow>Cost</PartnerSectionEyebrow>
        <div className="mb-5 flex items-center gap-2">
          <h3 className={pmSectionTitle}>Average cost per move</h3>
          <InfoHint ariaLabel="Chart scope" align="end" className="shrink-0">
            Trend over the period selected above (30 / 90 / 365 days).
          </InfoHint>
        </div>
        <div className="h-[200px] w-full min-w-0 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyCost} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`$${v ?? 0}`, "Avg cost"]}
              />
              <Line
                type="monotone"
                dataKey="avgCost"
                stroke={FOREST}
                strokeWidth={1.75}
                dot={{ r: 2.5, fill: FOREST, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: WINE, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-0 border-b border-[#2C3E2D]/10 sm:border-b-0">
        <section className="pt-8 pb-8 sm:pr-8 sm:border-r border-[#2C3E2D]/10">
          <PartnerSectionEyebrow>Portfolio</PartnerSectionEyebrow>
          <h3 className={pmSectionTitle}>Service area mix</h3>
          <div className="h-[180px] w-full min-w-0 mt-5 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.zoneDistribution}
                  dataKey="count"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.zoneDistribution.map((_entry, i) => (
                    <Cell key={i} fill={CHART_ZONE_COLORS[i % CHART_ZONE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 justify-center sm:justify-start">
            {data.zoneDistribution.map((z, i) => (
              <div
                key={z.zone}
                className="flex items-center gap-2 text-[10px] font-medium text-[#5A6B5E]"
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{
                    backgroundColor: CHART_ZONE_COLORS[i % CHART_ZONE_COLORS.length],
                  }}
                />
                {z.zone} ({z.pct}%)
              </div>
            ))}
          </div>
        </section>

        <section className="pt-8 pb-8 sm:pl-8 border-t sm:border-t-0 border-[#2C3E2D]/10">
          <PartnerSectionEyebrow>Ratings</PartnerSectionEyebrow>
          <h3 className={pmSectionTitle}>Satisfaction breakdown</h3>
          <div className="h-[180px] w-full min-w-0 mt-5 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ratingDistribution} layout="vertical" margin={{ left: 4, right: 8 }}>
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="stars"
                  width={52}
                  tick={{ fontSize: 10, fill: "#5A6B5E" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v} star${v === 1 ? "" : "s"}`}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill={WINE} radius={[0, 1, 1, 0]} name="Ratings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {data.recentComments.length > 0 && (
        <section className="pt-8 pb-8 border-b border-[#2C3E2D]/10">
          <PartnerSectionEyebrow>Feedback</PartnerSectionEyebrow>
          <h3 className={pmSectionTitle}>Recent resident comments</h3>
          <ul className="mt-5 divide-y divide-[#2C3E2D]/10">
            {data.recentComments.map((c, i) => (
              <li key={i} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[12px] font-semibold text-[#1a1f1b] truncate">
                      {c.name}
                    </span>
                    <div className="flex gap-0.5 shrink-0" aria-label={`${c.rating} of 5 stars`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={11}
                          color={WINE}
                          weight={n <= c.rating ? "fill" : "regular"}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#5A6B5E] tabular-nums">{c.date}</span>
                </div>
                <p className="text-[12px] text-[#5A6B5E] leading-relaxed">&ldquo;{c.comment}&rdquo;</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pt-8 pb-2">
        <PartnerSectionEyebrow>Operations</PartnerSectionEyebrow>
        <h3 className={pmSectionTitle}>Move performance</h3>
        <div className="mt-5 overflow-x-auto -mx-1">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#2C3E2D]/10">
                {(
                  ["Date", "Move type", "Region", "Time", "On-time", "Rating", "Damage"] as const
                ).map((col) => (
                  <th
                    key={col}
                    className="pb-3 pr-4 text-[9px] font-bold tracking-[0.12em] uppercase text-[#5A6B5E] whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentDeliveries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-[13px] text-[#5A6B5E]"
                  >
                    No completed moves in this period.
                  </td>
                </tr>
              ) : (
                data.recentDeliveries.map((d, i) => (
                  <tr key={i} className="border-b border-[#2C3E2D]/5 last:border-0">
                    <td className="py-3 pr-4 text-[#1a1f1b] tabular-nums whitespace-nowrap">
                      {d.date}
                    </td>
                    <td className="py-3 pr-4 text-[#5A6B5E]">{d.type}</td>
                    <td className="py-3 pr-4 text-[#5A6B5E] max-w-[140px] truncate" title={d.zone}>
                      {d.zone}
                    </td>
                    <td className="py-3 pr-4 text-[#5A6B5E] tabular-nums">{d.minutes}m</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          d.onTime ? "text-emerald-700 font-medium" : "text-red-600 font-medium"
                        }
                      >
                        {d.onTime ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#5A6B5E]">
                      {d.rating ? `${d.rating} stars` : "—"}
                    </td>
                    <td className="py-3">
                      <span
                        className={
                          d.hasDamage ? "text-red-600 font-medium" : "text-emerald-700 font-medium"
                        }
                      >
                        {d.hasDamage ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

type AnalyticsSub = "insights" | "history";

/** Analytics with underline sub-tabs: Insights (charts) and Move history (filterable table). */
export function PartnerPmAnalyticsTab({
  buildingOptions,
  preview = false,
}: {
  buildingOptions: { id: string; building_name: string }[];
  /** Sample portal — move history uses static rows instead of the API. */
  preview?: boolean;
}) {
  const [sub, setSub] = useState<AnalyticsSub>("insights");
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partner/pm/analytics?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    if (sub !== "insights") return;
    load();
  }, [sub, load]);

  return (
    <div className="space-y-0 text-[#1a1f1b]">
      <div className="pb-2">
        <PartnerSectionEyebrow>Analytics</PartnerSectionEyebrow>
        <div
          className="flex items-center justify-start sm:justify-center gap-0 overflow-x-auto overflow-y-hidden scrollbar-hide border-b border-[#2C3E2D]/10 mt-3"
          style={{
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
            overscrollBehaviorY: "none",
          }}
          role="tablist"
          aria-label="Analytics sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sub === "insights"}
            onClick={() => setSub("insights")}
            className={`${SUBTAB_BTN} ${
              sub === "insights"
                ? "border-[#2C3E2D] text-[#1a1f1b]"
                : "border-transparent text-[#5A6B5E] hover:text-[#1a1f1b]/80"
            }`}
          >
            Insights
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sub === "history"}
            onClick={() => setSub("history")}
            className={`${SUBTAB_BTN} ${
              sub === "history"
                ? "border-[#2C3E2D] text-[#1a1f1b]"
                : "border-transparent text-[#5A6B5E] hover:text-[#1a1f1b]/80"
            }`}
          >
            Move history
          </button>
        </div>
      </div>

      {sub === "history" && (
        <div className="pt-4">
          <PartnerPmMoveHistoryTab embedded preview={preview} buildingOptions={buildingOptions} />
        </div>
      )}

      {sub === "insights" && (
        <>
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div
                className="w-7 h-7 rounded-full border-2 border-[#5C1A33]/20 border-t-[#5C1A33] animate-spin"
                aria-hidden
              />
            </div>
          )}
          {!loading && !data && (
            <p className={`text-center py-20 ${pmBodyMuted}`}>
              Unable to load analytics data.
            </p>
          )}
          {!loading && data && (
            <>
              <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between pb-8 border-b border-[#2C3E2D]/10 pt-6">
                <div>
                  <PartnerPageTitle>Performance analytics</PartnerPageTitle>
                </div>
                <div className="flex w-full sm:w-auto border border-[#2C3E2D]/12 rounded-sm overflow-hidden divide-x divide-[#2C3E2D]/10">
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPeriod(opt.value)}
                      className={`flex-1 sm:flex-none px-3 py-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors [font-family:var(--font-body)] ${
                        period === opt.value
                          ? "bg-[#5C1A33]/[0.08] text-[#5C1A33]"
                          : "bg-transparent text-[#5A6B5E] hover:bg-[#2C3E2D]/[0.03] hover:text-[#1a1f1b]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </header>
              <PartnerPmInsightsBody data={data} />
            </>
          )}
        </>
      )}
    </div>
  );
}
