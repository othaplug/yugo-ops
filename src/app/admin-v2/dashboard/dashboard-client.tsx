"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { CloudSun, ArrowsClockwise, CircleNotch } from "@phosphor-icons/react"
import { formatMoveDate } from "@/lib/date-format"
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency"
import { serviceTypeDisplayLabel } from "@/lib/displayLabels"
import {
  getStatusLabel,
  normalizeStatus,
  CREW_STATUS_TO_LABEL,
} from "@/lib/move-status"
import {
  buildPrecipAlertText,
  type MoveWeatherBrief,
} from "@/lib/weather/move-weather-brief"
import { getLocalHourInAppTimezone } from "@/lib/business-timezone"
import { formatDate } from "@/lib/client-timezone"
import type { DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief"
import type { CommandCenterData, CommandCenterJob } from "@/lib/admin/command-center-data"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard"
import {
  Card,
  CardHeader,
  CardSubtitle,
  CardTitle,
} from "@/components/admin-v2/composites/Card"
import { Chip, variantForStatus } from "@/components/admin-v2/primitives/Chip"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import { cn } from "@/components/admin-v2/lib/cn"
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import { LiveActivityCard } from "@/components/admin-v2/modules/live-activity-card"
import { RevenueForecastCard } from "@/components/admin-v2/modules/revenue-forecast-card"

export type DashboardClientProps = CommandCenterData & {
  userFirstName?: string | null
}

type LiveSession = {
  id: string
  jobId: string
  jobType: string
  jobName: string
  status: string
  teamName: string
  crewLeadName: string
  updatedAt: string
  toAddress: string | null
}

const getJobHref = (job: CommandCenterJob) => {
  if (job.type === "delivery") {
    return `/admin/deliveries/${encodeURIComponent(job.delivery_number || job.id)}`
  }
  const slug = job.move_code?.replace(/^#/, "").trim().toUpperCase() || job.id
  return `/admin/moves/${slug}`
}

const formatRelative = (iso: string) => {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return "just now"
  return `${Math.floor(sec / 60)}m ago`
}

export const DashboardClient = ({
  userFirstName,
  revenueV2,
  todayJobs,
  upcomingJobs,
  todayJobCount,
  overdueAmount,
  overdueCount,
  currentMonthRevenue,
  revenuePctChange,
  revenueBreakdown,
  activityEvents,
  activeQuotesCount,
  actionTasks,
  unassignedJobs,
  crewCapacity,
  quotePipeline,
  todayEarnings,
  dailyBrief,
  leadPulse,
  revenueForecast,
}: DashboardClientProps) => {
  const router = useRouter()
  const [revenuePeriod, setRevenuePeriod] = React.useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("monthly")
  const [briefOpen, setBriefOpen] = React.useState(true)
  const [tasksOpen, setTasksOpen] = React.useState(true)
  const [liveSessions, setLiveSessions] = React.useState<LiveSession[]>([])
  const [liveErr, setLiveErr] = React.useState(false)
  const [hqWeather, setHqWeather] = React.useState<{
    brief: MoveWeatherBrief
    alert: string | null
  } | null>(null)
  const [hqLoading, setHqLoading] = React.useState(true)
  const [weatherByMoveId, setWeatherByMoveId] = React.useState<
    Record<string, { brief: MoveWeatherBrief; alert: string | null }>
  >({})
  const [weatherLoading, setWeatherLoading] = React.useState(false)
  const [trafficByMoveId, setTrafficByMoveId] = React.useState<
    Record<string, DrivingTrafficBrief>
  >({})
  const [trafficLoading, setTrafficLoading] = React.useState(false)

  const now = new Date()
  const hour = getLocalHourInAppTimezone(now)
  const greetingBase =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const greeting =
    userFirstName?.trim() != null && userFirstName.trim() !== ""
      ? `${greetingBase}, ${userFirstName.trim()}`
      : greetingBase
  const dateLine = formatDate(now, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })

  const revenueChartRows = React.useMemo(() => {
    const pick =
      revenuePeriod === "daily"
        ? revenueV2.byDay
        : revenuePeriod === "weekly"
          ? revenueV2.byWeek
          : revenuePeriod === "monthly"
            ? revenueV2.byMonth
            : revenueV2.byYear
    return pick.map((row) => ({
      label: row.label,
      moves: row.moves,
      partner: row.partner,
    }))
  }, [revenuePeriod, revenueV2])

  const weatherInput = React.useMemo(() => {
    return [...todayJobs, ...upcomingJobs]
      .filter(
        (j) =>
          !j.weatherBrief &&
          j.fromAddress &&
          j.fromAddress.length >= 4 &&
          j.date,
      )
      .slice(0, 8)
      .map((j) => ({ id: j.id, fromAddress: j.fromAddress!, date: j.date }))
  }, [todayJobs, upcomingJobs])

  const moveTrafficKey = React.useMemo(() => {
    const ids = new Set<string>()
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (j.type !== "move") continue
      const f = j.fromAddress?.trim()
      const t = j.toAddress?.trim()
      if (f && t && f.length >= 4 && t.length >= 4) ids.add(j.id)
    }
    return [...ids].sort().slice(0, 12).join("|")
  }, [todayJobs, upcomingJobs])

  const refresh = React.useCallback(async () => {
    router.refresh()
  }, [router])
  const { containerRef: pullRef, pullDistance, refreshing } = usePullToRefresh({
    onRefresh: refresh,
  })

  React.useEffect(() => {
    const load = () => {
      fetch("/api/tracking/active")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { sessions?: LiveSession[] }) => {
          setLiveSessions(d.sessions || [])
          setLiveErr(false)
        })
        .catch(() => setLiveErr(true))
    }
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setHqLoading(true)
    fetch("/api/admin/hq-weather")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: { brief?: MoveWeatherBrief | null; alert?: string | null }) => {
          if (cancelled) return
          if (d.brief) setHqWeather({ brief: d.brief, alert: d.alert ?? null })
          else setHqWeather(null)
        },
      )
      .catch(() => {
        if (!cancelled) setHqWeather(null)
      })
      .finally(() => {
        if (!cancelled) setHqLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (weatherInput.length === 0) {
      setWeatherByMoveId({})
      return
    }
    let cancelled = false
    setWeatherLoading(true)
    fetch("/api/admin/command-center-weather", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moves: weatherInput }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: {
          weather?: Record<string, { brief: MoveWeatherBrief; alert: string | null }>
        }) => {
          if (!cancelled) setWeatherByMoveId(d.weather || {})
        },
      )
      .catch(() => {
        if (!cancelled) setWeatherByMoveId({})
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weatherInput])

  React.useEffect(() => {
    if (!moveTrafficKey) {
      setTrafficByMoveId({})
      return
    }
    const moveIds = moveTrafficKey.split("|").filter(Boolean)
    if (moveIds.length === 0) return
    let cancelled = false
    setTrafficLoading(true)
    fetch("/api/admin/command-center-traffic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveIds }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { traffic?: Record<string, DrivingTrafficBrief> }) => {
        if (!cancelled) setTrafficByMoveId(d.traffic || {})
      })
      .catch(() => {
        if (!cancelled) setTrafficByMoveId({})
      })
      .finally(() => {
        if (!cancelled) setTrafficLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [moveTrafficKey])

  const allWeatherRows = React.useMemo(() => {
    const rows: {
      id: string
      subtitle: string
      date: string
      brief: MoveWeatherBrief
      alert: string | null
    }[] = []
    const seen = new Set<string>()
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (seen.has(j.id)) continue
      seen.add(j.id)
      const brief = j.weatherBrief || weatherByMoveId[j.id]?.brief || null
      const alert = j.weatherAlert || weatherByMoveId[j.id]?.alert || null
      if (brief) {
        rows.push({
          id: j.id,
          subtitle: j.subtitle,
          date: j.date,
          brief,
          alert: alert || buildPrecipAlertText(brief),
        })
      }
    }
    return rows
      .sort((a, b) => {
        if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "")
        return a.subtitle.localeCompare(b.subtitle)
      })
      .slice(0, 8)
  }, [todayJobs, upcomingJobs, weatherByMoveId])

  const trafficRows = React.useMemo(() => {
    const out: {
      id: string
      subtitle: string
      date: string
      brief: DrivingTrafficBrief
    }[] = []
    for (const j of [...todayJobs, ...upcomingJobs]) {
      if (j.type !== "move") continue
      const brief = trafficByMoveId[j.id]
      if (brief) out.push({ id: j.id, subtitle: j.subtitle, date: j.date, brief })
    }
    return out
      .sort((a, b) => {
        if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "")
        return a.subtitle.localeCompare(b.subtitle)
      })
      .slice(0, 8)
  }, [todayJobs, upcomingJobs, trafficByMoveId])

  const hasJobs = todayJobs.length > 0 || upcomingJobs.length > 0
  const displayJobs = todayJobs.length > 0 ? todayJobs : upcomingJobs
  const scheduleLabel =
    todayJobs.length > 0 ? "Today's schedule" : "Upcoming"

  const moMDelta =
    currentMonthRevenue > 0 || revenuePctChange !== 0
      ? {
          value: `${revenuePctChange >= 0 ? "+" : ""}${revenuePctChange}% MoM`,
          direction:
            revenuePctChange > 0
              ? ("up" as const)
              : revenuePctChange < 0
                ? ("down" as const)
                : ("flat" as const),
        }
      : undefined

  return (
    <div
      ref={pullRef as React.RefObject<HTMLDivElement>}
      className="relative flex min-h-full w-full min-w-0 flex-col"
    >
      {(pullDistance > 0 || refreshing) && (
        <div
          className="fixed left-1/2 z-50 flex size-9 -translate-x-1/2 items-center justify-center rounded-md border border-line bg-surface shadow-sm"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 8px)",
            transform: `translate(-50%, ${pullDistance}px)`,
          }}
          aria-live="polite"
        >
          {refreshing ? (
            <CircleNotch className="size-4 animate-spin text-fg-muted" aria-hidden />
          ) : (
            <ArrowsClockwise
              className="size-4 text-fg-muted"
              style={{
                transform: `rotate(${(pullDistance / 72) * 180}deg)`,
                transition: "transform 0.1s",
              }}
              aria-hidden
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <PageHeader
          title="Dashboard"
          description={`${greeting}. ${"Operational snapshot across moves, partner logistics, and revenue."}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${ADMIN_V2_BASE}/quotes/new`}>New quote</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${ADMIN_V2_BASE}/moves/new`}>New move</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`${ADMIN_V2_BASE}/calendar`}>
                  <Icon name="calendar" size="sm" className="mr-1" />
                  Calendar
                </Link>
              </Button>
            </div>
          }
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <Chip label={dateLine} variant="neutral" />
              {!hqLoading && hqWeather?.brief ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                  <CloudSun className="size-3.5 shrink-0" weight="duotone" />
                  {hqWeather.brief.conditionsSummary}
                </span>
              ) : null}
              {activeQuotesCount > 0 ? (
                <Chip
                  label={`${activeQuotesCount} open quotes`}
                  variant="neutral"
                />
              ) : null}
              {actionTasks.length > 0 ? (
                <Chip
                  label={`${actionTasks.length} tasks`}
                  variant="info"
                />
              ) : null}
              {todayJobCount > 0 ? (
                <Chip
                  label={`${todayJobCount} jobs today`}
                  variant="success"
                />
              ) : null}
            </div>
          }
        />

        <MetricStrip
          items={[
            {
              label: "Revenue (month)",
              value: formatCurrencyCompact(currentMonthRevenue),
              delta: moMDelta,
            },
            { label: "Jobs today", value: String(todayJobCount) },
            { label: "Task queue", value: String(actionTasks.length) },
            { label: "Open quotes", value: String(activeQuotesCount) },
          ]}
        />

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label-sm text-fg-subtle">Daily brief</p>
              <CardTitle>At a glance</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="iconSm"
              onClick={() => setBriefOpen((v) => !v)}
              aria-expanded={briefOpen}
              aria-label={briefOpen ? "Collapse daily brief" : "Expand daily brief"}
            >
              <Icon
                name="caretRight"
                className={cn("size-4 transition-transform", briefOpen && "rotate-90")}
              />
            </Button>
          </div>
          {briefOpen ? (
            <p className="mt-3 body-sm leading-relaxed text-fg-muted">
              {dailyBrief}
            </p>
          ) : null}
        </Card>

        {liveErr ? (
          <p className="body-xs text-fg-subtle">Live crew tracking unavailable. Retrying.</p>
        ) : null}
        {liveSessions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-sm text-success">Live</span>
            {liveSessions.map((s) => (
              <Button key={s.id} variant="secondary" size="sm" asChild>
                <Link
                  href={
                    s.jobType === "move"
                      ? `/admin/moves/${s.jobId}`
                      : `/admin/deliveries/${s.jobId}`
                  }
                >
                  {s.teamName} · {CREW_STATUS_TO_LABEL[s.status] || s.status} · {formatRelative(s.updatedAt)}
                </Link>
              </Button>
            ))}
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${ADMIN_V2_BASE}/dispatch`}>View map</Link>
            </Button>
          </div>
        ) : null}

        {unassignedJobs.length > 0 ? (
          <Card className="border-warning/30 bg-warning-bg/30">
            <CardHeader>
              <div>
                <CardTitle>
                  {unassignedJobs.length} unassigned in the next 72 hours
                </CardTitle>
                <CardSubtitle>Assign a crew in Dispatch</CardSubtitle>
              </div>
              <Button variant="secondary" size="sm" asChild>
                <Link href={`${ADMIN_V2_BASE}/dispatch`}>Open dispatch</Link>
              </Button>
            </CardHeader>
            <ul className="divide-y divide-line border-t border-line">
              {unassignedJobs.slice(0, 5).map((j) => (
                <li key={j.id}>
                  <Link
                    href={j.href}
                    className="flex items-center justify-between gap-2 py-2 body-sm text-fg hover:bg-surface-subtle"
                  >
                    <span>
                      {formatMoveDate(j.date)} · {j.name}
                    </span>
                    <Chip label={j.type} variant="neutral" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {actionTasks.length > 0 ? (
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle>Tasks</CardTitle>
                <CardSubtitle>Delivery requests and change requests</CardSubtitle>
                <div className="mt-2">
                  <Chip label={String(actionTasks.length)} variant="info" />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                onClick={() => setTasksOpen((v) => !v)}
                aria-expanded={tasksOpen}
                aria-label="Toggle tasks"
              >
                <Icon
                  name="caretRight"
                  className={cn("size-4 transition-transform", tasksOpen && "rotate-90")}
                />
              </Button>
            </div>
            {tasksOpen ? (
              <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                {actionTasks.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="flex flex-col gap-0.5 py-3 body-sm transition-colors hover:bg-surface-subtle"
                    >
                      <span className="font-medium text-fg">{t.title}</span>
                      {t.subtitle ? (
                        <span className="body-xs text-fg-muted">{t.subtitle}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}

        <div className="grid min-w-0 w-full grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{scheduleLabel}</CardTitle>
                  <CardSubtitle>Moves and partner deliveries</CardSubtitle>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${ADMIN_V2_BASE}/calendar`}>
                    Calendar
                    <Icon name="arrowUpRight" size="sm" className="ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              {hasJobs ? (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {displayJobs.slice(0, 10).map((job) => {
                    const st =
                      job.type === "move"
                        ? getStatusLabel(job.status)
                        : job.status
                    return (
                      <li key={`${job.type}-${job.id}`}>
                        <Link
                          href={getJobHref(job)}
                          className="flex items-start justify-between gap-3 py-3 body-sm hover:bg-surface-subtle"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="label-sm text-fg-subtle">
                                {todayJobs.length === 0
                                  ? job.date
                                    ? formatMoveDate(job.date)
                                    : "TBD"
                                  : job.time}
                              </span>
                              <Chip
                                label={st}
                                variant={variantForStatus(
                                  job.type === "move"
                                    ? normalizeStatus(job.status) || job.status
                                    : job.status,
                                )}
                              />
                              <Chip label={job.tag} variant="neutral" />
                            </div>
                            <p className="mt-0.5 font-medium text-fg">{job.name}</p>
                            <p className="body-xs text-fg-muted font-mono">
                              {job.subtitle}
                            </p>
                            {job.weatherAlert ? (
                              <p className="mt-1 body-xs text-info">{job.weatherAlert}</p>
                            ) : null}
                          </div>
                          <Icon name="caretRight" className="mt-1 size-4 shrink-0 text-fg-subtle" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="body-sm text-fg-muted">
                  No jobs on the board. Create a quote or check the calendar.
                </p>
              )}
            </Card>

            {(allWeatherRows.length > 0 || trafficRows.length > 0 || weatherLoading || trafficLoading) ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Weather and route</CardTitle>
                    <CardSubtitle>Field conditions for scheduled work</CardSubtitle>
                  </div>
                </CardHeader>
                {weatherLoading && trafficLoading && allWeatherRows.length === 0 && trafficRows.length === 0 ? (
                  <p className="body-sm text-fg-muted">Loading conditions</p>
                ) : null}
                <div className="space-y-3">
                  {allWeatherRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-md border border-line bg-surface-subtle p-3"
                    >
                      <p className="label-sm text-fg">{row.subtitle}</p>
                      <p className="mt-1 body-sm text-fg-muted">{row.brief.conditionsSummary}</p>
                    </div>
                  ))}
                  {trafficRows.map((row) => (
                    <div
                      key={`t-${row.id}`}
                      className="rounded-md border border-line bg-surface-subtle p-3"
                    >
                      <p className="label-sm text-fg">{row.brief.congestionSummary}</p>
                      <p className="mt-1 body-xs text-fg-muted">
                        {row.brief.distanceKm} km · {row.brief.durationTrafficMin} min
                      </p>
                    </div>
                  ))}
                </div>
                {allWeatherRows.length === 0 && trafficRows.length === 0 && !weatherLoading && !trafficLoading ? (
                  <p className="body-sm text-fg-muted">
                    Add street addresses to moves for weather and traffic intel.
                  </p>
                ) : null}
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Revenue</CardTitle>
                  <CardSubtitle>Paid moves and partner (B2B), pre-tax</CardSubtitle>
                </div>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/admin/revenue">
                    Details
                    <Icon name="arrowUpRight" size="sm" className="ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-fg">
                  {formatCurrencyCompact(currentMonthRevenue)}
                </span>
                {moMDelta ? (
                  <Chip
                    label={moMDelta.value}
                    variant={moMDelta.direction === "up" ? "success" : moMDelta.direction === "down" ? "danger" : "neutral"}
                  />
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 body-xs text-fg-muted">
                {revenueBreakdown.moves > 0 ? (
                  <span>Moves {formatCurrencyCompact(revenueBreakdown.moves)}</span>
                ) : null}
                {revenueBreakdown.partner > 0 ? (
                  <span>Partner {formatCurrencyCompact(revenueBreakdown.partner)}</span>
                ) : null}
              </div>
              <div
                className="mt-4 flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Revenue period"
              >
                {(
                  [
                    ["daily", "Daily"],
                    ["weekly", "Weekly"],
                    ["monthly", "Monthly"],
                    ["yearly", "Yearly"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    type="button"
                    variant={revenuePeriod === id ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setRevenuePeriod(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="mt-3 w-full min-h-0 min-w-0 h-[min(360px,46vh)] sm:h-[min(400px,50vh)]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke="var(--color-line)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v as number)}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-line)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value, name) => [
                        formatCompactCurrency(Number(value ?? 0)),
                        name === "moves" ? "Moves" : "Partner (B2B)",
                      ]}
                    />
                    <Legend />
                    <Bar
                      name="moves"
                      dataKey="moves"
                      stackId="a"
                      fill="var(--color-accent)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      name="partner"
                      dataKey="partner"
                      stackId="a"
                      fill="var(--color-graph-purple)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <RevenueForecastCard initialData={revenueForecast} />
          </div>

          <div className="min-w-0 flex flex-col gap-6">
            {todayEarnings.jobCount > 0 ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Today&apos;s earnings</CardTitle>
                    <CardSubtitle>Potential vs collected (pre-tax)</CardSubtitle>
                  </div>
                </CardHeader>
                <p className="display-sm text-fg">
                  {formatCurrency(todayEarnings.potential)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full bg-success transition-all"
                    style={{
                      width: `${todayEarnings.potential > 0 ? Math.round((todayEarnings.collected / todayEarnings.potential) * 100) : 0}%`,
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between body-xs text-fg-muted">
                  <span>Collected {formatCurrency(todayEarnings.collected)}</span>
                  <span>Pending {formatCurrency(todayEarnings.pending)}</span>
                </div>
              </Card>
            ) : null}

            {overdueAmount > 0 ? (
              <Card className="border-danger/30 bg-danger-bg/40">
                <Button variant="ghost" className="h-auto w-full p-0" asChild>
                  <Link
                    href={`${ADMIN_V2_BASE}/invoices`}
                    className="flex w-full items-center justify-between gap-2 p-0 text-left"
                  >
                    <div>
                      <p className="label-sm text-danger">Overdue</p>
                      <p className="text-xl font-semibold text-danger">
                        {formatCompactCurrency(overdueAmount)}
                      </p>
                      <p className="body-xs text-fg-muted">
                        {overdueCount} invoice{overdueCount > 1 ? "s" : ""}
                      </p>
                    </div>
                    <Icon name="arrowUpRight" className="text-danger" size="md" />
                  </Link>
                </Button>
              </Card>
            ) : null}

            {crewCapacity.length > 0 && crewCapacity[0].total > 0 ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Crew capacity</CardTitle>
                    <CardSubtitle>Next three days</CardSubtitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`${ADMIN_V2_BASE}/dispatch`}>Dispatch</Link>
                  </Button>
                </CardHeader>
                <div className="grid grid-cols-3 gap-2">
                  {crewCapacity.map((day) => {
                    const free = day.total - day.booked
                    const isFull = free === 0
                    return (
                      <div
                        key={day.date}
                        className="rounded-md border border-line bg-surface-subtle p-2 text-center"
                      >
                        <p className="label-sm text-fg-subtle">{day.label}</p>
                        <p className="mt-1 text-sm font-semibold text-fg">
                          {day.booked}/{day.total}
                        </p>
                        <p className={cn("text-xs", isFull ? "text-danger" : "text-success")}>
                          {isFull ? "Full" : `${free} free`}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </Card>
            ) : null}

            {leadPulse &&
            (leadPulse.needsAttention > 0 ||
              leadPulse.monthReceived > 0 ||
              leadPulse.avgResponseMin != null) ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Leads</CardTitle>
                    <CardSubtitle>
                      New inquiries and how fast we respond
                    </CardSubtitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`${ADMIN_V2_BASE}/leads`}>Open</Link>
                  </Button>
                </CardHeader>
                <dl className="space-y-1 body-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Needs attention</dt>
                    <dd className="font-medium text-fg">{leadPulse.needsAttention}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">New this month</dt>
                    <dd className="font-medium text-fg">{leadPulse.monthReceived}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Avg response (min)</dt>
                    <dd className="font-medium text-fg">
                      {leadPulse.avgResponseMin ?? "N/A"}
                    </dd>
                  </div>
                </dl>
                {leadPulse.attentionPreview && leadPulse.attentionPreview.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line border-t border-line">
                    {leadPulse.attentionPreview.map((row) => (
                      <li key={row.id}>
                        <Link
                          href={`${ADMIN_V2_BASE}/leads/${row.id}`}
                          className="block py-2 body-sm hover:bg-surface-subtle"
                        >
                          <span className="font-mono text-xs text-fg-muted">
                            {row.lead_number}
                          </span>{" "}
                          {[row.first_name, row.last_name].filter(Boolean).join(" ")}
                          {row.service_type
                            ? ` · ${serviceTypeDisplayLabel(row.service_type)}`
                            : ""}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            ) : null}

            {quotePipeline.openCount > 0 || quotePipeline.acceptedThisWeek > 0 ? (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Quote pipeline</CardTitle>
                    <CardSubtitle>Open, viewed, accepted</CardSubtitle>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`${ADMIN_V2_BASE}/quotes`}>Quotes</Link>
                  </Button>
                </CardHeader>
                <dl className="space-y-2 body-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Open</dt>
                    <dd className="font-medium">{quotePipeline.openCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Open value</dt>
                    <dd>{formatCompactCurrency(quotePipeline.openValue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Viewed</dt>
                    <dd>{quotePipeline.viewedCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Accepted (7d)</dt>
                    <dd className="text-success">{quotePipeline.acceptedThisWeek}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-2">
                    <dt className="text-fg-muted">30d conversion</dt>
                    <dd>{quotePipeline.conversionRate}%</dd>
                  </div>
                </dl>
                {quotePipeline.expiringToday > 0 ? (
                  <p className="mt-2 rounded-md border border-warning/30 bg-warning-bg/50 p-2 body-xs text-warning">
                    {quotePipeline.expiringToday} quote
                    {quotePipeline.expiringToday > 1 ? "s" : ""} expiring today
                  </p>
                ) : null}
              </Card>
            ) : null}

            <LiveActivityCard initialEvents={activityEvents} />
          </div>
        </div>
      </div>
    </div>
  )
}
