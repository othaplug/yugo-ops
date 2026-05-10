"use client"

import * as React from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from "recharts"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/admin-v2/primitives/Tabs"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/admin-v2/primitives/ToggleGroup"
import { formatCurrencyCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/admin-v2/format"
import { cn } from "@/components/admin-v2/lib/cn"

// ── Types ──────────────────────────────────────────────────────────────────

export type MonthPoint = {
  label: string
  revenue: number
  jobs: number
  avgValue: number
}

export type WeekPoint = {
  label: string
  leads: number
  quotes: number
  accepted: number
}

export type AnalyticsSummary = {
  thisMonthRevenue: number
  lastMonthRevenue: number
  threeMonthRevenue: number
  sixMonthRevenue: number
  completedJobs: number
  avgJobValue: number
  openQuotes: number
  conversionRate: number
}

export type AnalyticsClientProps = {
  monthPoints: MonthPoint[]
  weekPoints: WeekPoint[]
  summary: AnalyticsSummary
}

// ── Chart families ─────────────────────────────────────────────────────────

type FamilyId = "revenue" | "jobs" | "avg-value" | "leads" | "conversion"

type Family = {
  id: FamilyId
  label: string
  group: "Revenue" | "Pipeline"
  dataKey: string
  unit: "currency" | "number" | "percent"
  useWeek?: boolean
}

const FAMILIES: Family[] = [
  { id: "revenue", label: "Monthly revenue", group: "Revenue", dataKey: "revenue", unit: "currency" },
  { id: "jobs", label: "Job volume", group: "Revenue", dataKey: "jobs", unit: "number" },
  { id: "avg-value", label: "Avg job value", group: "Revenue", dataKey: "avgValue", unit: "currency" },
  { id: "leads", label: "Lead flow", group: "Pipeline", dataKey: "leads", unit: "number", useWeek: true },
  { id: "conversion", label: "Quote conversion", group: "Pipeline", dataKey: "accepted", unit: "number", useWeek: true },
]

type RangeId = "M" | "Q" | "Y" | "All"
const RANGES: RangeId[] = ["M", "Q", "Y", "All"]

const RANGE_LABEL: Record<RangeId, string> = {
  M: "1M",
  Q: "3M",
  Y: "12M",
  All: "All",
}

// ── Formatters ─────────────────────────────────────────────────────────────

const fmtAxis = (unit: Family["unit"]) => (v: number) => {
  if (unit === "currency") return formatCurrencyCompact(v)
  if (unit === "percent") return formatPercent(v)
  return formatNumber(v)
}

const fmtTooltip = (unit: Family["unit"]) => (v: number) => {
  if (unit === "currency") return formatCurrency(v)
  if (unit === "percent") return formatPercent(v, 1)
  return formatNumber(v)
}

// ── Delta helper ───────────────────────────────────────────────────────────

const delta = (current: number, prev: number): string | undefined => {
  if (prev === 0 || current === 0) return undefined
  const pct = ((current - prev) / prev) * 100
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

// ── Main component ─────────────────────────────────────────────────────────

export const AnalyticsClient = ({
  monthPoints,
  weekPoints,
  summary,
}: AnalyticsClientProps) => {
  const [tab, setTab] = React.useState<"revenue" | "operations" | "pipeline">("revenue")
  const [family, setFamily] = React.useState<FamilyId>("revenue")
  const [range, setRange] = React.useState<RangeId>("Y")
  const [chartType, setChartType] = React.useState<"line" | "bar">("bar")

  const activeFam = FAMILIES.find((f) => f.id === family) ?? FAMILIES[0]!

  // Slice data by range
  const chartData = React.useMemo(() => {
    const pts = activeFam.useWeek ? weekPoints : monthPoints
    if (range === "All" || range === "Y") return pts
    if (range === "Q") return activeFam.useWeek ? weekPoints.slice(-12) : monthPoints.slice(-3)
    if (range === "M") return activeFam.useWeek ? weekPoints.slice(-4) : monthPoints.slice(-1)
    return pts
  }, [activeFam, monthPoints, weekPoints, range])

  const ticks = React.useMemo(() => {
    const step = Math.max(1, Math.floor(chartData.length / 6))
    return chartData.filter((_, i) => i % step === 0).map((p) => p.label)
  }, [chartData])

  // Summary rows (revenue tab)
  const summaryRows = React.useMemo(
    () => [
      {
        label: "This month",
        value: formatCurrencyCompact(summary.thisMonthRevenue),
      },
      {
        label: "Last month",
        value: formatCurrencyCompact(summary.lastMonthRevenue),
        delta: delta(summary.thisMonthRevenue, summary.lastMonthRevenue),
        positive: summary.thisMonthRevenue >= summary.lastMonthRevenue,
      },
      {
        label: "3 months ago",
        value: formatCurrencyCompact(summary.threeMonthRevenue),
        delta: delta(summary.thisMonthRevenue, summary.threeMonthRevenue),
        positive: summary.thisMonthRevenue >= summary.threeMonthRevenue,
      },
      {
        label: "6 months ago",
        value: formatCurrencyCompact(summary.sixMonthRevenue),
        delta: delta(summary.thisMonthRevenue, summary.sixMonthRevenue),
        positive: summary.thisMonthRevenue >= summary.sixMonthRevenue,
      },
    ],
    [summary],
  )

  // Operations summary
  const opsRows = React.useMemo(
    () => [
      { label: "Completed jobs", value: formatNumber(summary.completedJobs) },
      { label: "Avg job value", value: formatCurrency(summary.avgJobValue) },
      { label: "Open quotes", value: formatNumber(summary.openQuotes) },
      { label: "Quote conversion", value: formatPercent(summary.conversionRate) },
    ],
    [summary],
  )

  const activeSummaryRows = tab === "revenue" ? summaryRows : opsRows

  // Table data (show month or week points depending on active family)
  const tablePoints = activeFam.useWeek ? weekPoints : monthPoints
  const tableTicks = React.useMemo(() => {
    const step = Math.max(1, Math.floor(tablePoints.length / 6))
    return tablePoints.filter((_, i) => i % step === 0).map((p) => p.label)
  }, [tablePoints])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Icon name="download" size="sm" weight="bold" />}
              onClick={() => toast.info("Export coming soon")}
            >
              Export
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <div className="grid gap-4 lg:grid-cols-[220px_1fr_260px]">
            {/* Left: chart family list */}
            <aside className="rounded-lg border border-line bg-surface p-3">
              {(["Revenue", "Pipeline"] as const).map((group) => {
                const items = FAMILIES.filter((f) => f.group === group)
                if (tab === "revenue" && group === "Pipeline") return null
                if (tab === "pipeline" && group === "Revenue") return null
                if (tab === "operations") return null
                return (
                  <div key={group} className="mt-1 first:mt-0">
                    <p className="label-sm text-fg-subtle px-2">{group}</p>
                    <ul className="mt-1 space-y-0.5">
                      {items.map((f) => {
                        const active = f.id === family
                        return (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => setFamily(f.id)}
                              className={cn(
                                "w-full rounded-md px-2 py-1.5 text-left body-sm transition-colors",
                                active
                                  ? "bg-accent-subtle text-accent font-medium"
                                  : "text-fg hover:bg-surface-subtle",
                              )}
                            >
                              {f.label}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {tab === "operations" && (
                <div className="flex flex-col gap-3 mt-1">
                  {opsRows.map((row) => (
                    <div key={row.label} className="px-2 py-2 rounded-md border border-line bg-surface-subtle">
                      <p className="label-xs text-fg-subtle">{row.label}</p>
                      <p className="display-xs text-fg mt-0.5 tabular-nums">{row.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </aside>

            {/* Center: chart */}
            <section className="rounded-lg border border-line bg-surface p-5">
              <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <div>
                  <h2 className="heading-md text-fg">
                    {tab === "operations"
                      ? "Job volume by month"
                      : activeFam.label}
                  </h2>
                  <p className="body-xs text-fg-subtle mt-0.5">Last 12 months · completed moves</p>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={chartType}
                    onValueChange={(v) => { if (v) setChartType(v as typeof chartType) }}
                  >
                    <ToggleGroupItem value="line" aria-label="Line chart">
                      <Icon name="analytics" size="sm" weight="bold" />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="bar" aria-label="Bar chart">
                      <Icon name="reports" size="sm" weight="bold" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(v) => { if (v) setRange(v as RangeId) }}
                  >
                    {RANGES.map((r) => (
                      <ToggleGroupItem key={r} value={r}>
                        {RANGE_LABEL[r]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </header>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "line" ? (
                    <LineChart data={tab === "operations" ? monthPoints : chartData}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        ticks={ticks}
                        tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtAxis(tab === "operations" ? "number" : activeFam.unit)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-line)",
                          fontSize: 12,
                        }}
                        formatter={(v: unknown) =>
                          fmtTooltip(tab === "operations" ? "number" : activeFam.unit)(Number(v))
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey={tab === "operations" ? "jobs" : activeFam.dataKey}
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={tab === "operations" ? monthPoints : chartData}>
                      <CartesianGrid stroke="var(--color-line)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        ticks={ticks}
                        tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--color-fg-subtle)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={fmtAxis(tab === "operations" ? "number" : activeFam.unit)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-line)",
                          fontSize: 12,
                        }}
                        formatter={(v: unknown) =>
                          fmtTooltip(tab === "operations" ? "number" : activeFam.unit)(Number(v))
                        }
                      />
                      <Bar
                        dataKey={tab === "operations" ? "jobs" : activeFam.dataKey}
                        fill="var(--color-accent)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            {/* Right: summary */}
            <aside className="rounded-lg border border-line bg-surface p-5">
              <p className="label-sm text-fg-subtle">Summary</p>
              <ul className="mt-3 divide-y divide-line">
                {activeSummaryRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="label-sm text-fg-subtle">{row.label}</p>
                      <p className="display-xs text-fg tabular-nums mt-1">{row.value}</p>
                    </div>
                    {(row as { delta?: string; positive?: boolean }).delta ? (
                      <span
                        className={cn(
                          "label-sm mt-1 shrink-0",
                          (row as { positive?: boolean }).positive ? "text-success" : "text-danger",
                        )}
                      >
                        {(row as { delta?: string }).delta}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          {/* Bottom: data table */}
          <section className="mt-4 rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between px-5 py-3 border-b border-line">
              <h3 className="heading-sm text-fg">
                {tab === "pipeline" ? "Lead & quote data" : "Revenue breakdown"}
              </h3>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 body-sm">
                <thead>
                  <tr className="bg-surface-subtle">
                    <th className="sticky left-0 z-10 border-b border-line bg-surface-subtle px-4 py-2 text-left label-sm text-fg-subtle">
                      Period
                    </th>
                    {tableTicks.map((t) => (
                      <th
                        key={t}
                        className="border-b border-line px-4 py-2 text-right label-sm text-fg-subtle tabular-nums"
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tab === "pipeline"
                    ? [
                        { id: "leads", label: "Leads" },
                        { id: "quotes", label: "Quotes sent" },
                        { id: "accepted", label: "Accepted" },
                      ].map((row) => (
                        <tr key={row.id}>
                          <td className="sticky left-0 z-10 border-t border-line bg-surface px-4 py-2 text-fg">
                            {row.label}
                          </td>
                          {tableTicks.map((tick, idx) => {
                            const point = weekPoints.find((p) => p.label === tick) ??
                              weekPoints[idx * Math.max(1, Math.floor(weekPoints.length / tableTicks.length))]
                            const value = point
                              ? (point as unknown as Record<string, number>)[row.id] ?? 0
                              : 0
                            return (
                              <td
                                key={tick}
                                className="border-t border-line px-4 py-2 text-right text-fg tabular-nums"
                              >
                                {formatNumber(value)}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    : [
                        { id: "revenue", label: "Revenue", fmt: formatCurrencyCompact },
                        { id: "jobs", label: "Jobs", fmt: formatNumber },
                        { id: "avgValue", label: "Avg value", fmt: formatCurrencyCompact },
                      ].map((row) => (
                        <tr key={row.id}>
                          <td className="sticky left-0 z-10 border-t border-line bg-surface px-4 py-2 text-fg">
                            {row.label}
                          </td>
                          {tableTicks.map((tick, idx) => {
                            const point = monthPoints.find((p) => p.label === tick) ??
                              monthPoints[idx * Math.max(1, Math.floor(monthPoints.length / tableTicks.length))]
                            const value = point
                              ? (point as unknown as Record<string, number>)[row.id] ?? 0
                              : 0
                            return (
                              <td
                                key={tick}
                                className="border-t border-line px-4 py-2 text-right text-fg tabular-nums"
                              >
                                {row.fmt(value)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
