"use client"

import * as React from "react"
import { TrendUp, ChartBar, CurrencyDollar, CircleNotch } from "@phosphor-icons/react"
import type { RevenueForecastPayload } from "@/lib/admin/revenue-forecast-types"
import { Button } from "../primitives/Button"
import { CardTitle } from "../composites/Card"

const fmt = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toLocaleString()}`
}

type Props = {
  /**
   * When set from the server (Ops+ / Supabase), skips a duplicate client fetch.
   * `null` means the server could not build the payload (error UI, no refetch).
   * Omit to load via `/api/admin/finance/revenue-forecast` (e.g. legacy admin widget).
   */
  initialData?: RevenueForecastPayload | null
}

/** Revenue forecast: same figures as the finance API, styled for admin-v2 tokens only. */
export const RevenueForecastCard = ({ initialData }: Props) => {
  const [data, setData] = React.useState<RevenueForecastPayload | null>(
    () => (initialData !== undefined ? initialData : null),
  )
  const [loading, setLoading] = React.useState(initialData === undefined)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<7 | 14 | 30>(7)

  React.useEffect(() => {
    if (initialData !== undefined) {
      setData(initialData)
      setLoading(false)
      setLoadError(
        initialData ? null : "Forecast could not be loaded from the server.",
      )
      return
    }
    setLoadError(null)
    fetch("/api/admin/finance/revenue-forecast", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) {
          setLoadError(
            r.status === 401
              ? "Sign in again to load the forecast."
              : "Forecast could not be loaded.",
          )
          return null
        }
        return r.json() as Promise<RevenueForecastPayload>
      })
      .then((d) => {
        if (d?.forecasts) setData(d)
        setLoading(false)
      })
      .catch(() => {
        setLoadError("Forecast could not be loaded.")
        setLoading(false)
      })
  }, [initialData])

  const current = data?.forecasts?.find((f) => f.days === selected)

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <TrendUp
            className="size-4 shrink-0 text-fg-muted"
            weight="duotone"
            aria-hidden
          />
          <div>
            <p className="label-sm text-fg-subtle">Pipeline</p>
            <CardTitle>Revenue forecast</CardTitle>
          </div>
        </div>
        <div
          className="flex shrink-0 flex-wrap gap-1"
          role="tablist"
          aria-label="Forecast window"
        >
          {([7, 14, 30] as const).map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={selected === d ? "primary" : "secondary"}
              onClick={() => setSelected(d)}
              className="min-w-12"
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <CircleNotch
              className="size-5 animate-spin text-accent"
              weight="duotone"
              aria-hidden
            />
          </div>
        ) : loadError ? (
          <p className="body-sm text-fg-muted">{loadError}</p>
        ) : !current ? (
          <p className="body-sm text-fg-muted">No forecast data available.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-line bg-surface-subtle p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <CurrencyDollar
                    className="size-3.5 text-success"
                    weight="duotone"
                    aria-hidden
                  />
                  <span className="label-sm text-success">Confirmed</span>
                </div>
                <p className="text-xl font-semibold tabular-nums text-fg">
                  {fmt(current.confirmedRevenue)}
                </p>
                <p className="mt-0.5 body-xs text-fg-muted">Next {selected} days</p>
              </div>
              <div className="rounded-md border border-line bg-surface-subtle p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <ChartBar
                    className="size-3.5 text-fg-muted"
                    weight="duotone"
                    aria-hidden
                  />
                  <span className="label-sm text-fg-muted">Pipeline</span>
                </div>
                <p className="text-xl font-semibold tabular-nums text-fg">
                  {fmt(current.pipelineRevenue)}
                </p>
                <p className="mt-0.5 body-xs text-fg-muted">
                  {current.quoteCount} quote{current.quoteCount !== 1 ? "s" : ""} × {Math.round((data?.conversionRate || 0.35) * 100)}%
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-line bg-surface-sunken px-3 py-2.5">
              <span className="label-sm text-fg-muted">Total projected</span>
              <span className="text-base font-semibold tabular-nums text-fg">
                {fmt(current.confirmedRevenue + current.pipelineRevenue)}
              </span>
            </div>

            {data?.forecasts ? (
              <div>
                <p className="mb-2 label-sm text-fg-subtle">All periods</p>
                <div className="space-y-2">
                  {data.forecasts.map((f) => {
                    const max = Math.max(
                      ...data.forecasts.map(
                        (x) => x.confirmedRevenue + x.pipelineRevenue,
                      ),
                      1,
                    )
                    const total = f.confirmedRevenue + f.pipelineRevenue
                    const confirmedPct = (f.confirmedRevenue / max) * 100
                    const pipelinePct = (f.pipelineRevenue / max) * 100
                    return (
                      <div key={f.days} className="flex items-center gap-3">
                        <span className="w-8 shrink-0 label-sm tabular-nums text-fg-muted">
                          {f.days}d
                        </span>
                        <div className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${confirmedPct}%`,
                              background: "var(--color-success)",
                            }}
                          />
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${pipelinePct}%`,
                              background: "var(--color-graph-purple)",
                              opacity: 0.75,
                            }}
                          />
                        </div>
                        <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums text-fg">
                          {fmt(total)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="size-2 shrink-0 rounded-sm"
                      style={{ background: "var(--color-success)" }}
                    />
                    <span className="label-sm text-fg-muted">Confirmed</span>
                  </div>
                  <p className="text-xs text-fg-muted">
                    Pipeline ({Math.round(data.conversionRate * 100)}% conv.)
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
