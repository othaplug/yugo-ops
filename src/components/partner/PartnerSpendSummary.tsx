"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartBar, SpinnerGap } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";

const BG = "#FAF8F5";
const GOLD = "#B8962E";
const TEXT = "#2C3E2D";

type SpendSummary = {
  monthlySpend: { month: string; total: number }[];
  totalSpend: number;
  deliveryCount: number;
  invoiceCount: number;
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

export default function PartnerSpendSummary() {
  const [data, setData] = useState<SpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/partner/spend-summary");
        const json = (await res.json()) as SpendSummary & { error?: string };
        if (!res.ok)
          throw new Error(json.error || "Could not load spend summary");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Could not load spend summary",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxBar = useMemo(() => {
    if (!data?.monthlySpend?.length) return 1;
    return Math.max(1, ...data.monthlySpend.map((m) => m.total));
  }, [data]);

  if (loading) {
    return (
      <div
        className="flex min-h-[160px] items-center justify-center gap-2 rounded-2xl border px-4 py-8"
        style={{ backgroundColor: BG, borderColor: `${GOLD}55`, color: TEXT }}
      >
        <SpinnerGap
          className="h-6 w-6 animate-spin"
          style={{ color: GOLD }}
          aria-hidden
        />
        <span className="text-sm font-medium">Loading spend summary…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-2xl border px-4 py-6 text-sm"
        style={{ backgroundColor: BG, borderColor: `${GOLD}55`, color: TEXT }}
        role="alert"
      >
        {error || "No data available."}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border-2 p-5 shadow-sm"
      style={{ backgroundColor: BG, borderColor: GOLD, color: TEXT }}
    >
      <div className="flex items-center gap-2">
        <ChartBar
          className="h-6 w-6"
          style={{ color: GOLD }}
          weight="duotone"
          aria-hidden
        />
        <h2 className="text-lg font-semibold tracking-tight">Delivery spend</h2>
      </div>
      <p className="mt-1 text-sm opacity-80">
        Last six months, based on scheduled delivery dates.
      </p>

      <p
        className="mt-5 text-3xl font-bold tracking-tight"
        style={{ color: TEXT }}
      >
        {formatCurrency(data.totalSpend)}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        Total spend (6 months)
      </p>

      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-70">
          Monthly
        </p>
        <div className="flex h-[7.5rem] items-end justify-between gap-1.5">
          {data.monthlySpend.map((m) => {
            const maxPx = 104;
            const barPx =
              maxBar > 0
                ? Math.max(m.total > 0 ? 6 : 3, (m.total / maxBar) * maxPx)
                : 3;
            return (
              <div
                key={m.month}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full max-w-[2.5rem] rounded-t-md transition-all"
                  style={{
                    height: barPx,
                    backgroundColor: GOLD,
                    opacity: m.total > 0 ? 1 : 0.35,
                  }}
                  title={`${formatMonthLabel(m.month)}: ${formatCurrency(m.total)}`}
                />
                <span className="text-[10px] font-medium leading-none opacity-75">
                  {formatMonthLabel(m.month).split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 text-sm">
        <div>
          <dt className="opacity-70">Deliveries</dt>
          <dd className="text-lg font-semibold">{data.deliveryCount}</dd>
        </div>
        <div>
          <dt className="opacity-70">Invoices</dt>
          <dd className="text-lg font-semibold">{data.invoiceCount}</dd>
        </div>
      </dl>
    </div>
  );
}
