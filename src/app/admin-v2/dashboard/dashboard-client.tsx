"use client"

import * as React from "react"
import Link from "next/link"
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricCard } from "@/components/admin-v2/composites/MetricCard"
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/admin-v2/composites/Card"
import { Chip, variantForStatus } from "@/components/admin-v2/primitives/Chip"
import { Avatar } from "@/components/admin-v2/primitives/Avatar"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import { Button } from "@/components/admin-v2/primitives/Button"
import {
  CREW_AVAILABILITY_LABEL,
  LEAD_STATUS_LABEL,
  MOVE_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  TIER_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/admin-v2/format"
import { getMockUniverse } from "@/lib/admin-v2/mock"
import type {
  CrewMember,
  Lead,
  Move,
  Quote,
} from "@/lib/admin-v2/mock/types"

const DAY_MS = 24 * 60 * 60 * 1000

const sourceOf = (lead: Lead): string => lead.source

// Pipeline funnel buckets taken from PRD §6.5 and match Meetalo tabs.
const FUNNEL_ORDER: Array<Lead["status"]> = [
  "new",
  "pre-sale",
  "closing",
  "closed",
  "lost",
]

const DONUT_COLORS = [
  "var(--color-accent)",
  "var(--color-graph-green)",
  "var(--color-graph-purple)",
  "var(--color-info)",
  "var(--color-warning)",
  "var(--color-graph-red)",
]

export const DashboardClient = () => {
  const universe = React.useMemo(() => getMockUniverse(), [])
  const { leads, moves, quotes, crew } = universe

  const metrics = React.useMemo(() => {
    const now = Date.now()
    const last7 = leads.filter(
      (l) => now - new Date(l.lastAction).getTime() < 7 * DAY_MS,
    )
    const active = moves.filter((m) =>
      ["scheduled", "pre-move", "in-transit"].includes(m.status),
    )
    const revenueMtd = moves
      .filter((m) => {
        const ts = new Date(m.scheduledAt).getTime()
        return (
          m.status === "completed" && now - ts < 30 * DAY_MS && ts <= now
        )
      })
      .reduce((sum, m) => sum + m.total, 0)
    const pipelineValue = leads
      .filter((l) => ["new", "pre-sale", "closing"].includes(l.status))
      .reduce((sum, l) => sum + l.size, 0)
    return {
      revenueMtd,
      activeCount: active.length,
      newCount: last7.filter((l) => l.status === "new").length,
      pipelineValue,
    }
  }, [leads, moves])

  const mrrSeries = React.useMemo(() => buildMrrSeries(moves), [moves])
  const funnel = React.useMemo(() => buildFunnel(leads), [leads])
  const sources = React.useMemo(() => buildSourceAttribution(leads), [leads])
  const todayMoves = React.useMemo(() => buildTodayMoves(moves), [moves])
  const crewAvailability = React.useMemo(
    () => buildCrewAvailability(crew),
    [crew],
  )
  const expiringQuotes = React.useMemo(
    () => buildExpiringQuotes(quotes),
    [quotes],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Operational snapshot across leads, quotes, moves, and revenue."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Revenue MTD"
          value={formatCurrencyCompact(metrics.revenueMtd)}
          delta={{ value: "+3%", direction: "up" }}
          sparkline={mrrSeries.current.slice(-12).map((p) => p.value)}
        />
        <MetricCard
          label="Active moves"
          value={metrics.activeCount.toString()}
          delta={{ value: "-4%", direction: "down" }}
        />
        <MetricCard
          label="New leads · 7d"
          value={metrics.newCount.toString()}
          delta={{ value: "+24%", direction: "up" }}
          sparkline={[3, 5, 4, 6, 7, 9, 11]}
        />
        <MetricCard
          label="Pipeline value"
          value={formatCurrencyCompact(metrics.pipelineValue)}
          delta={{ value: "+12%", direction: "up" }}
        />
      </div>

      <Card padding="none">
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <CardTitle>Revenue</CardTitle>
            <CardSubtitle>Monthly recurring revenue · current vs prior period</CardSubtitle>
          </div>
          <Button variant="secondary" size="sm">
            2025 — 2026
          </Button>
        </div>
        <div className="mt-4 h-[280px] px-3 pb-6">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mrrSeries.merged}>
              <CartesianGrid
                stroke="var(--color-line)"
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="var(--color-fg-subtle)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis
                stroke="var(--color-fg-subtle)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickFormatter={(value) =>
                  formatCurrencyCompact(value as number)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => formatCurrency(value as number)}
                labelStyle={{ color: "var(--color-fg)" }}
              />
              <Line
                type="monotone"
                dataKey="current"
                stroke="var(--color-accent)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Current"
              />
              <Line
                type="monotone"
                dataKey="prior"
                stroke="var(--color-fg-subtle)"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                name="Prior"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pipeline funnel</CardTitle>
              <CardSubtitle>Leads by stage · 30 day window</CardSubtitle>
            </div>
          </CardHeader>
          <div className="mt-4 flex flex-col gap-3">
            {funnel.map((stage, index) => {
              const max = funnel[0]?.count ?? 1
              const pct = Math.max(0.04, stage.count / max)
              return (
                <div key={stage.status} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between body-sm text-fg">
                    <span className="flex items-center gap-2">
                      <Chip
                        label={LEAD_STATUS_LABEL[stage.status]}
                        variant={variantForStatus(stage.status)}
                      />
                      <span className="tabular-nums">{stage.count}</span>
                    </span>
                    {index > 0 ? (
                      <span className="label-sm text-fg-subtle tabular-nums">
                        {formatPercent(stage.conversion, 1)}
                      </span>
                    ) : null}
                  </div>
                  <div className="h-2 w-full rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Source attribution</CardTitle>
              <CardSubtitle>Where new leads come from · 30d</CardSubtitle>
            </div>
          </CardHeader>
          <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-[160px_1fr]">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                    isAnimationActive={false}
                  >
                    {sources.map((_, index) => (
                      <Cell
                        key={index}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {sources.map((entry, index) => (
                <li
                  key={entry.name}
                  className="flex items-center justify-between body-sm"
                >
                  <span className="flex items-center gap-2 text-fg">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        background:
                          DONUT_COLORS[index % DONUT_COLORS.length],
                      }}
                      aria-hidden
                    />
                    {entry.name}
                  </span>
                  <span className="label-sm text-fg-muted tabular-nums">
                    {formatPercent(entry.percent, 0)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Today&apos;s moves</CardTitle>
              <CardSubtitle>Next five on the schedule</CardSubtitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin-v2/moves">Open</Link>
            </Button>
          </CardHeader>
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {todayMoves.length === 0 ? (
              <li className="px-3 py-3 body-sm text-fg-subtle">
                No moves on the schedule today.
              </li>
            ) : (
              todayMoves.map((move) => (
                <li
                  key={move.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="body-sm font-medium text-fg truncate">
                      {move.number} · {move.customerName}
                    </p>
                    <p className="body-xs text-fg-subtle truncate">
                      {TIER_LABEL[move.tier]} · {formatTimeOfDay(move.scheduledAt)}
                    </p>
                  </div>
                  <Chip
                    label={MOVE_STATUS_LABEL[move.status]}
                    variant={variantForStatus(move.status)}
                  />
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Crew availability</CardTitle>
              <CardSubtitle>Who is ready to dispatch right now</CardSubtitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin-v2/crew">Open</Link>
            </Button>
          </CardHeader>
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {crewAvailability.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={member.name}
                    size="sm"
                    status={
                      member.availability === "available"
                        ? "success"
                        : member.availability === "on-move"
                          ? "warning"
                          : "offline"
                    }
                  />
                  <div className="min-w-0">
                    <p className="body-sm font-medium text-fg truncate">
                      {member.name}
                    </p>
                    <p className="body-xs text-fg-subtle truncate capitalize">
                      {member.role} · {member.movesCompleted} moves
                    </p>
                  </div>
                </div>
                <Chip
                  label={CREW_AVAILABILITY_LABEL[member.availability]}
                  variant={
                    member.availability === "available"
                      ? "success"
                      : member.availability === "on-move"
                        ? "info"
                        : "neutral"
                  }
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Expiring quotes</CardTitle>
              <CardSubtitle>Next five to follow up</CardSubtitle>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin-v2/quotes">Open</Link>
            </Button>
          </CardHeader>
          <ul className="mt-4 divide-y divide-line rounded-md border border-line">
            {expiringQuotes.map((quote) => (
              <li
                key={quote.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="body-sm font-medium text-fg truncate">
                    {quote.number} · {quote.customerName}
                  </p>
                  <p className="body-xs text-fg-subtle truncate">
                    Expires {formatShortDate(quote.expiresAt)} · {formatCurrencyCompact(quote.total)}
                  </p>
                </div>
                <Chip
                  label={QUOTE_STATUS_LABEL[quote.status]}
                  variant={variantForStatus(quote.status)}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

const buildMrrSeries = (moves: Move[]) => {
  const months = 12
  const now = new Date()
  const current: Array<{ label: string; value: number; index: number }> = []
  const prior: Array<{ label: string; value: number; index: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)
    const start = date.getTime()
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime()
    const priorStart = new Date(date.getFullYear() - 1, date.getMonth(), 1).getTime()
    const priorEnd = new Date(date.getFullYear() - 1, date.getMonth() + 1, 1).getTime()

    const sumBetween = (a: number, b: number) =>
      moves
        .filter((m) => {
          const ts = new Date(m.scheduledAt).getTime()
          return ts >= a && ts < b && m.status !== "cancelled"
        })
        .reduce((sum, m) => sum + m.total, 0)

    current.push({ label, value: sumBetween(start, end), index: months - i })
    prior.push({
      label,
      value: sumBetween(priorStart, priorEnd),
      index: months - i,
    })
  }
  const merged = current.map((point, idx) => ({
    label: point.label,
    current: point.value,
    prior: prior[idx]?.value ?? 0,
  }))
  return { current, prior, merged }
}

const buildFunnel = (leads: Lead[]) => {
  const totals = FUNNEL_ORDER.map((status) => ({
    status,
    count: leads.filter((l) => l.status === status).length,
  }))
  return totals.map((stage, index) => ({
    ...stage,
    conversion:
      index === 0
        ? 1
        : totals[index - 1]!.count > 0
          ? stage.count / totals[index - 1]!.count
          : 0,
  })).map((stage) => ({
    ...stage,
    conversion: stage.conversion * 100,
  }))
}

const buildSourceAttribution = (leads: Lead[]) => {
  const counts = new Map<string, number>()
  for (const lead of leads) {
    const key = sourceOf(lead)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = leads.length || 1
  return Array.from(counts.entries())
    .map(([name, value]) => ({
      name,
      value,
      percent: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

const buildTodayMoves = (moves: Move[]) => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const tomorrowStart = todayStart.getTime() + DAY_MS
  return moves
    .filter((m) => {
      const ts = new Date(m.scheduledAt).getTime()
      return ts >= todayStart.getTime() && ts < tomorrowStart
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .slice(0, 5)
}

const buildCrewAvailability = (crew: CrewMember[]) =>
  [...crew]
    .sort((a, b) => {
      const rank: Record<CrewMember["availability"], number> = {
        available: 0,
        "on-move": 1,
        "off-duty": 2,
      }
      return rank[a.availability] - rank[b.availability]
    })
    .slice(0, 5)

const buildExpiringQuotes = (quotes: Quote[]) =>
  [...quotes]
    .filter((q) => q.status === "sent" || q.status === "viewed")
    .sort(
      (a, b) =>
        new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    )
    .slice(0, 5)
