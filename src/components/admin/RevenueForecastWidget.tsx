"use client";

import { useState, useEffect } from "react";
import { TrendUp, ChartBar, CurrencyDollar } from "@phosphor-icons/react";

interface ForecastPeriod {
  days: 7 | 14 | 30;
  confirmedRevenue: number;
  pipelineRevenue: number;
  quoteCount: number;
}

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

export default function RevenueForecastWidget() {
  const [data, setData] = useState<{
    forecasts: ForecastPeriod[];
    conversionRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    setLoadError(null);
    fetch("/api/admin/finance/revenue-forecast", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) {
          setLoadError(
            r.status === 401
              ? "Sign in again to load the forecast."
              : "Forecast could not be loaded.",
          );
          return null;
        }
        return r.json() as Promise<{
          forecasts: ForecastPeriod[];
          conversionRate: number;
        }>;
      })
      .then((d) => {
        if (d?.forecasts) setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoadError("Forecast could not be loaded.");
        setLoading(false);
      });
  }, []);

  const current = data?.forecasts?.find((f) => f.days === selected);

  return (
    <div className="rounded-sm border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[var(--brd)]/30 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <TrendUp size={16} color="var(--tx2)" />
          <span className="admin-eyebrow min-w-0 truncate">
            Revenue Forecast
          </span>
        </div>
        {/* Period selector */}
        <div className="flex shrink-0 rounded-sm overflow-hidden border border-[var(--brd)] divide-x divide-[var(--brd)]/60">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelected(d)}
              className={`px-2.5 py-1 min-w-[2.25rem] text-[10px] font-bold uppercase tracking-[0.06em] transition-colors ${
                selected === d
                  ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]"
                  : "text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--hover)]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-[var(--tx)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <p className="text-[12px] text-[var(--tx2)] leading-relaxed">{loadError}</p>
        ) : !current ? (
          <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
            No forecast data available.
          </p>
        ) : (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-sm bg-[var(--card)] border border-[var(--brd)] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CurrencyDollar size={12} color="var(--grn)" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--grn)]">
                    Confirmed
                  </span>
                </div>
                <div className="text-[20px] font-bold text-[var(--tx)]">
                  {fmt(current.confirmedRevenue)}
                </div>
                <div className="text-[10px] font-medium text-[var(--tx2)] mt-0.5">
                  Next {selected} days
                </div>
              </div>
              <div className="rounded-sm bg-[var(--card)] border border-[var(--brd)] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ChartBar size={12} color="var(--tx2)" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)]">
                    Pipeline
                  </span>
                </div>
                <div className="text-[20px] font-bold text-[var(--tx)]">
                  {fmt(current.pipelineRevenue)}
                </div>
                <div className="text-[10px] font-medium text-[var(--tx2)] mt-0.5">
                  {current.quoteCount} quote
                  {current.quoteCount !== 1 ? "s" : ""} ×{" "}
                  {Math.round((data?.conversionRate || 0.35) * 100)}%
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-sm bg-[var(--gdim)] border border-[var(--brd)]">
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)]">
                Total Projected
              </span>
              <span className="text-[16px] font-bold text-[var(--tx)]">
                {fmt(current.confirmedRevenue + current.pipelineRevenue)}
              </span>
            </div>

            {/* Bar chart visualization */}
            {data?.forecasts && (
              <div>
                <p className="admin-eyebrow mb-2 opacity-90">All Periods</p>
                <div className="space-y-2">
                  {data.forecasts.map((f) => {
                    const max = Math.max(
                      ...data.forecasts.map(
                        (x) => x.confirmedRevenue + x.pipelineRevenue,
                      ),
                      1,
                    );
                    const total = f.confirmedRevenue + f.pipelineRevenue;
                    const confirmedPct = (f.confirmedRevenue / max) * 100;
                    const pipelinePct = (f.pipelineRevenue / max) * 100;
                    return (
                      <div key={f.days} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--tx2)] w-8 shrink-0 tabular-nums">
                          {f.days}d
                        </span>
                        <div className="flex-1 h-3 bg-[var(--brd)]/25 rounded-sm overflow-hidden flex">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${confirmedPct}%`,
                              background: "var(--grn)",
                            }}
                          />
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${pipelinePct}%`,
                              background: "var(--tx2)",
                              opacity: 0.4,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[var(--tx)] w-16 text-right shrink-0">
                          {fmt(total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: "var(--grn)" }}
                    />
                    <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--tx2)]">
                      Confirmed
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm bg-[var(--tx2)] opacity-60 shrink-0" />
                    <span className="text-[10px] text-[var(--tx2)] leading-snug">
                      Pipeline ({Math.round(data.conversionRate * 100)}% conv.)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
