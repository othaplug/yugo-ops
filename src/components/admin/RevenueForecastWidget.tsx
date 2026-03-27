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
  const [data, setData] = useState<{ forecasts: ForecastPeriod[]; conversionRate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    fetch("/api/admin/finance/revenue-forecast")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.forecasts) setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const current = data?.forecasts?.find((f) => f.days === selected);

  return (
    <div className="rounded-2xl border border-[var(--brd)]/40 bg-[var(--card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--brd)]/30">
        <div className="flex items-center gap-2">
          <TrendUp size={16} color="var(--tx2)" />
          <span className="text-[11px] font-bold tracking-widest capitalize text-[var(--tx3)]">
            Revenue Forecast
          </span>
        </div>
        {/* Period selector */}
        <div className="flex rounded-lg overflow-hidden border border-[var(--brd)]/40">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={`px-3 py-1 text-[10px] font-bold transition-all ${
                selected === d
                  ? "bg-[var(--tx)] text-[var(--bg)]"
                  : "text-[var(--tx3)] hover:text-[var(--tx)]"
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
        ) : !current ? (
          <p className="text-[12px] text-[var(--tx3)]">No forecast data available.</p>
        ) : (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[var(--bg)] border border-[var(--brd)]/30 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CurrencyDollar size={12} color="#22c55e" />
                  <span className="text-[10px] font-bold capitalize tracking-wider text-[#22c55e]">
                    Confirmed
                  </span>
                </div>
                <div className="text-[20px] font-bold text-[var(--tx)]">
                  {fmt(current.confirmedRevenue)}
                </div>
                <div className="text-[10px] text-[var(--tx3)] mt-0.5">Next {selected} days</div>
              </div>
              <div className="rounded-xl bg-[var(--bg)] border border-[var(--brd)]/30 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ChartBar size={12} color="var(--tx2)" />
                  <span className="text-[10px] font-bold capitalize tracking-wider text-[var(--tx2)]">
                    Pipeline
                  </span>
                </div>
                <div className="text-[20px] font-bold text-[var(--tx)]">
                  {fmt(current.pipelineRevenue)}
                </div>
                <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                  {current.quoteCount} quote{current.quoteCount !== 1 ? "s" : ""} × {Math.round((data?.conversionRate || 0.35) * 100)}%
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--gold)]/6 border border-black/15">
              <span className="text-[11px] font-semibold text-[var(--tx3)]">Total Projected</span>
              <span className="text-[16px] font-bold text-[var(--gold)]">
                {fmt(current.confirmedRevenue + current.pipelineRevenue)}
              </span>
            </div>

            {/* Bar chart visualization */}
            {data?.forecasts && (
              <div>
                <p className="text-[10px] font-semibold capitalize tracking-wider text-[var(--tx3)]/60 mb-2">
                  All Periods
                </p>
                <div className="space-y-2">
                  {data.forecasts.map((f) => {
                    const max = Math.max(...data.forecasts.map((x) => x.confirmedRevenue + x.pipelineRevenue), 1);
                    const total = f.confirmedRevenue + f.pipelineRevenue;
                    const confirmedPct = (f.confirmedRevenue / max) * 100;
                    const pipelinePct = (f.pipelineRevenue / max) * 100;
                    return (
                      <div key={f.days} className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--tx3)] w-8 shrink-0">{f.days}d</span>
                        <div className="flex-1 h-4 bg-[var(--brd)]/20 rounded-full overflow-hidden flex">
                          <div
                            className="h-full rounded-l-full transition-all"
                            style={{ width: `${confirmedPct}%`, background: "#22c55e" }}
                          />
                          <div
                            className="h-full transition-all"
                            style={{ width: `${pipelinePct}%`, background: "var(--tx2)", opacity: 0.4 }}
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
                    <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                    <span className="text-[10px] text-[var(--tx3)]">Confirmed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[var(--tx2)] opacity-60" />
                    <span className="text-[10px] text-[var(--tx3)]">Pipeline ({Math.round((data.conversionRate) * 100)}% conv.)</span>
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
