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
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import { cn } from "@/components/admin-v2/lib/cn"

type FamilyId =
  | "mrr"
  | "mrr-movements"
  | "net-mrr"
  | "run-rate"
  | "forecast"
  | "leads"
  | "trial-conversion"
  | "funnel"
  | "sales-cycle"

type Family = {
  id: FamilyId
  label: string
  group: "Charts" | "Pipeline"
}

const FAMILIES: Family[] = [
  { id: "mrr", label: "MRR", group: "Charts" },
  { id: "mrr-movements", label: "MRR movements", group: "Charts" },
  { id: "net-mrr", label: "Net MRR change", group: "Charts" },
  { id: "run-rate", label: "Annual run rate", group: "Charts" },
  { id: "forecast", label: "CMRR forecast", group: "Charts" },
  { id: "leads", label: "Leads", group: "Pipeline" },
  { id: "trial-conversion", label: "Trial conversion", group: "Pipeline" },
  { id: "funnel", label: "Funnel analysis", group: "Pipeline" },
  { id: "sales-cycle", label: "Sales cycle", group: "Pipeline" },
]

type RangeId = "D" | "W" | "M" | "Q" | "Y" | "All"
const RANGES: RangeId[] = ["D", "W", "M", "Q", "Y", "All"]

const seed = (offset: number) => {
  let x = offset + 1
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

const makeSeries = (id: FamilyId, length = 24, base = 800) => {
  const rand = seed(id.length * 17)
  const points: { label: string; value: number }[] = []
  let value = base
  for (let i = 0; i < length; i += 1) {
    value += (rand() - 0.4) * 80
    const month = new Date(2023, i % 24, 1).toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    })
    points.push({ label: month, value: Math.max(0, Math.round(value)) })
  }
  return points
}

const SUMMARY_ROWS: Array<{ label: string; value: string; delta?: string }> = [
  { label: "Current MRR", value: "$1,254" },
  { label: "30 days ago", value: "$1,216", delta: "+4.2%" },
  { label: "60 days ago", value: "$1,109", delta: "+13.6%" },
  { label: "180 days ago", value: "$983", delta: "+27.5%" },
  { label: "360 days ago", value: "$850", delta: "+47.1%" },
]

export const AnalyticsClient = () => {
  const [tab, setTab] = React.useState<"revenue" | "operations" | "customer" | "marketing">("revenue")
  const [family, setFamily] = React.useState<FamilyId>("mrr")
  const [range, setRange] = React.useState<RangeId>("Y")
  const [chartType, setChartType] = React.useState<"line" | "bar">("line")

  const data = React.useMemo(() => makeSeries(family), [family])

  const ticks = React.useMemo(() => {
    const step = Math.max(1, Math.floor(data.length / 8))
    return data
      .filter((_, index) => index % step === 0)
      .map((point) => point.label)
  }, [data])

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
              onClick={() => toast.info("Exported CSV")}
            >
              Export
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => toast.success("Report created")}
            >
              Create report
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
            <aside className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center gap-2 pb-3 border-b border-line">
                <ToggleGroup
                  type="single"
                  value="charts"
                  onValueChange={() => undefined}
                >
                  <ToggleGroupItem value="charts">Charts</ToggleGroupItem>
                  <ToggleGroupItem value="maps">Maps</ToggleGroupItem>
                </ToggleGroup>
              </div>
              {["Charts", "Pipeline"].map((group) => (
                <div key={group} className="mt-3">
                  <p className="label-sm text-fg-subtle px-2">{group}</p>
                  <ul className="mt-1 space-y-0.5">
                    {FAMILIES.filter((f) => f.group === group).map((f) => {
                      const active = f.id === family
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => setFamily(f.id)}
                            className={cn(
                              "w-full rounded-md px-2 py-1.5 text-left body-sm transition-colors",
                              active
                                ? "bg-accent-subtle text-accent"
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
              ))}
            </aside>

            <section className="rounded-lg border border-line bg-surface p-5">
              <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <h2 className="heading-md text-fg">
                  {FAMILIES.find((f) => f.id === family)?.label}
                </h2>
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={chartType}
                    onValueChange={(v) => {
                      if (v) setChartType(v as typeof chartType)
                    }}
                  >
                    <ToggleGroupItem value="line" aria-label="Line chart">
                      <Icon
                        name="analytics"
                        size="sm"
                        weight="bold"
                      />
                    </ToggleGroupItem>
                    <ToggleGroupItem value="bar" aria-label="Bar chart">
                      <Icon name="reports" size="sm" weight="bold" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(v) => {
                      if (v) setRange(v as RangeId)
                    }}
                  >
                    {RANGES.map((r) => (
                      <ToggleGroupItem key={r} value={r}>
                        {r}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </header>

              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "line" ? (
                    <LineChart data={data}>
                      <CartesianGrid
                        stroke="var(--color-line)"
                        vertical={false}
                      />
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
                        tickFormatter={(value) => formatCurrencyCompact(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-line)",
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="var(--color-accent)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  ) : (
                    <BarChart data={data}>
                      <CartesianGrid
                        stroke="var(--color-line)"
                        vertical={false}
                      />
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
                        tickFormatter={(value) => formatCurrencyCompact(value)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-line)",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill="var(--color-accent)" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            <aside className="rounded-lg border border-line bg-surface p-5">
              <p className="label-sm text-fg-subtle">Summary</p>
              <ul className="mt-3 divide-y divide-line">
                {SUMMARY_ROWS.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="label-sm text-fg-subtle">{row.label}</p>
                      <p className="display-xs text-fg tabular-nums mt-1">
                        {row.value}
                      </p>
                    </div>
                    {row.delta ? (
                      <span className="label-sm text-success">{row.delta}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          <section className="mt-4 rounded-lg border border-line bg-surface">
            <header className="flex items-center justify-between px-5 py-3 border-b border-line">
              <h3 className="heading-sm text-fg">Chart data</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leadingIcon={<Icon name="download" size="sm" weight="bold" />}
                  onClick={() => toast.info("Data exported")}
                >
                  Export
                </Button>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 body-sm">
                <thead>
                  <tr className="bg-surface-subtle">
                    <th className="sticky left-0 z-10 border-b border-line bg-surface-subtle px-4 py-2 text-left label-sm text-fg-subtle">
                      Series
                    </th>
                    {ticks.map((t) => (
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
                  {[
                    { id: "new-business", label: "New Business MRR" },
                    { id: "expansion", label: "Expansion MRR" },
                    { id: "churn", label: "Churn" },
                  ].map((row) => (
                    <tr key={row.id} className="border-t border-line">
                      <td className="sticky left-0 z-10 border-t border-line bg-surface px-4 py-2 text-fg">
                        {row.label}
                      </td>
                      {ticks.map((_, index) => {
                        const point = data[index * Math.max(1, Math.floor(data.length / ticks.length))]
                        const value = point?.value ?? 0
                        return (
                          <td
                            key={index}
                            className="border-t border-line px-4 py-2 text-right text-fg tabular-nums"
                          >
                            {formatCurrencyCompact(value)}
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
