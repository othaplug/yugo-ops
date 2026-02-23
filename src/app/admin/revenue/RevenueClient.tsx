"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import BackButton from "../components/BackButton";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";

type Period = "6mo" | "year" | "ytd" | "monthly";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "6mo", label: "6 Month" },
  { key: "year", label: "Year" },
  { key: "ytd", label: "YTD" },
  { key: "monthly", label: "Daily" },
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface RevenueClientProps {
  invoices: any[];
  clientTypeMap?: Record<string, string>;
  clientNameToOrgId?: Record<string, string>;
}

/** Get revenue date for a paid invoice (when payment was received) */
function getRevenueDate(inv: any): Date {
  const ts = inv.updated_at || inv.created_at;
  return ts ? new Date(ts) : new Date(0);
}

export default function RevenueClient({ invoices, clientTypeMap = {}, clientNameToOrgId = {} }: RevenueClientProps) {
  const [period, setPeriod] = useState<Period>("6mo");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const outstanding = all
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);

  const byClient: Record<string, number> = {};
  paid.forEach((i) => {
    byClient[i.client_name] = (byClient[i.client_name] || 0) + Number(i.amount);
  });
  const topClients = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  /** Build real revenue data from paid invoices, grouped by month or day */
  const chartData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (period === "monthly") {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const byDay: Record<number, number> = {};
      for (let d = 1; d <= daysInMonth; d++) byDay[d] = 0;
      paid.forEach((inv) => {
        const d = getRevenueDate(inv);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          byDay[day] = (byDay[day] || 0) + Number(inv.amount);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return { label: String(day), value: byDay[day] || 0, fullLabel: `${now.toLocaleString("en-US", { month: "short" })} ${day}` };
      });
    }

    const monthsToShow =
      period === "6mo" ? 6 : period === "ytd" ? month + 1 : 12;
    const startMonth = period === "6mo" ? month - 5 : 0;
    const result: { label: string; value: number; fullLabel: string }[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      let m = startMonth + i;
      let y = year;
      if (m < 0) {
        m += 12;
        y -= 1;
      } else if (m >= 12) {
        m -= 12;
        y += 1;
      }
      let sum = 0;
      paid.forEach((inv) => {
        const d = getRevenueDate(inv);
        if (d.getFullYear() === y && d.getMonth() === m) sum += Number(inv.amount);
      });
      result.push({
        label: MONTH_LABELS[m],
        value: sum,
        fullLabel: `${MONTH_LABELS[m]} ${y}`,
      });
    }
    return result;
  }, [period, paid]);

  const byTypeRaw: Record<string, number> = {};
  paid.forEach((i) => {
    const t = clientTypeMap[i.client_name] || "retail";
    byTypeRaw[t] = (byTypeRaw[t] || 0) + Number(i.amount);
  });
  const byType = [
    { key: "retail", label: "Retail", amount: byTypeRaw.retail || 0, color: "var(--gold)" },
    { key: "designer", label: "Designer", amount: byTypeRaw.designer || 0, color: "var(--gold)" },
    { key: "hospitality", label: "Hospitality", amount: byTypeRaw.hospitality || 0, color: "var(--grn)" },
    { key: "gallery", label: "Gallery", amount: byTypeRaw.gallery || 0, color: "var(--tx3)" },
    { key: "realtor", label: "Realtor", amount: byTypeRaw.realtor || 0, color: "var(--tx3)" },
    { key: "b2c", label: "B2C Moves", amount: byTypeRaw.b2c || 0, color: "var(--tx3)" },
  ];
  const maxByType = Math.max(1, ...byType.map((t) => t.amount));
  const invoicesByType = useMemo(() => {
    if (!selectedType) return [];
    return all.filter((i) => (clientTypeMap[i.client_name] || "retail") === selectedType);
  }, [all, selectedType, clientTypeMap]);

  const now = new Date();
  const currentMonthRevenue = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth();
    return paid
      .filter((inv) => {
        const d = getRevenueDate(inv);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((s, i) => s + Number(i.amount), 0);
  }, [paid, now]);
  const prevMonthRevenue = useMemo(() => {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prev.getFullYear();
    const m = prev.getMonth();
    return paid
      .filter((inv) => {
        const d = getRevenueDate(inv);
        return d.getFullYear() === y && d.getMonth() === m;
      })
      .reduce((s, i) => s + Number(i.amount), 0);
  }, [paid, now]);
  const ytdRevenue = useMemo(() => {
    const y = now.getFullYear();
    return paid
      .filter((inv) => getRevenueDate(inv).getFullYear() === y)
      .reduce((s, i) => s + Number(i.amount), 0);
  }, [paid, now]);
  const avgJob = paid.length > 0 ? Math.round(paidTotal / paid.length) : 0;
  const pctChange =
    prevMonthRevenue > 0
      ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
      : currentMonthRevenue > 0
        ? 100
        : 0;

  const currentMonthLabel = now.toLocaleString("en-US", { month: "short" });

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* KPI Cards - real data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/invoices" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">{currentMonthLabel} Revenue</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(currentMonthRevenue)}</div>
          {pctChange !== 0 && (
            <div className={`text-[10px] font-semibold mt-0.5 ${pctChange >= 0 ? "text-[var(--grn)]" : "text-red-500"}`}>
              {pctChange >= 0 ? "↑" : "↓"}{Math.abs(pctChange)}% vs last month
            </div>
          )}
        </Link>
        <Link href="/admin/invoices" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">YTD</div>
          <div className="text-xl font-bold font-heading">{formatCompactCurrency(ytdRevenue)}</div>
        </Link>
        <Link href="/admin/invoices" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">{formatCompactCurrency(outstanding)}</div>
        </Link>
        <Link href="/admin/invoices" className="embossed-hover bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Avg Job</div>
          <div className="text-xl font-bold font-heading">{formatCompactCurrency(avgJob)}</div>
        </Link>
      </div>

      {/* Revenue Trend - real interactive chart */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-[20px] p-6 mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        <h3 className="font-heading text-[15px] font-bold text-[var(--tx)] mb-1">
          Revenue Trend{period === "monthly" ? ` — ${now.toLocaleString("en-US", { month: "long", year: "numeric" })}` : ` — ${now.getFullYear()}`}
        </h3>
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex gap-0.5 p-1 bg-[var(--bg)]/80 rounded-full">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                  period === opt.key ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[260px] w-full min-w-0">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--tx3)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--brd)" }}
                  interval={period === "monthly" ? Math.max(0, Math.floor(chartData.length / 15)) : 0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--tx3)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `$${v / 1000}K` : `$${v}`)}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--brd)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "var(--tx)" }}
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0), "Revenue"]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
                  cursor={{ fill: "rgba(201,169,98,0.08)" }}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  fill="rgba(201,169,98,0.5)"
                  stroke="var(--gold)"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[13px] text-[var(--tx3)]">
              No paid revenue in this period. Revenue appears when invoices are marked paid.
            </div>
          )}
        </div>
      </div>

      {/* By Type + Top Clients */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">By Type</h3>
          <p className="text-[10px] text-[var(--tx3)] mb-3">Revenue by service stream (Retail, Designer, B2C Moves, etc.)</p>
          <div className="space-y-3">
            {byType.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedType(t.key)}
                  className="block w-full text-left group"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{t.label}</span>
                    <span className="text-[11px] font-bold text-[var(--tx)]">{formatCurrency(t.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                      style={{ width: `${(t.amount / maxByType) * 100}%`, background: t.color }}
                    />
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Top Clients</h3>
            <Link href="/admin/clients" className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {topClients.length > 0 ? (
              topClients.map(([name, amount]) => {
                const orgId = clientNameToOrgId[name];
                const href = orgId ? `/admin/clients/${orgId}/revenue` : "/admin/clients";
                return (
                  <Link
                    key={name}
                    href={href}
                    className="group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg border border-transparent border-b border-[var(--brd)] last:border-0 hover:bg-[var(--gdim)] hover:border-[var(--gold)]/40 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                  >
                    <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{name}</span>
                    <span className="text-[11px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{formatCurrency(amount)}</span>
                  </Link>
                );
              })
            ) : (
              <div className="text-[11px] text-[var(--tx3)] py-4">No paid invoices yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Invoices by type modal */}
      {selectedType != null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedType(null)} aria-hidden="true" />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--brd)] shrink-0">
              <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">
                Invoices — {byType.find((t) => t.key === selectedType)?.label ?? selectedType}
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2 py-1.5 text-[var(--tx)]"
                >
                  {byType.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                >
                  View all
                </button>
                <button type="button" onClick={() => setSelectedType(null)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none">&times;</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {invoicesByType.length > 0 ? (
                <ul className="space-y-2">
                  {invoicesByType.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between py-2 border-b border-[var(--brd)] last:border-0 text-[11px]">
                      <span className="font-mono font-semibold text-[var(--tx)]">{inv.invoice_number}</span>
                      <span className="text-[var(--tx2)]">{inv.client_name}</span>
                      <span className="font-bold text-[var(--tx)]">{formatCurrency(inv.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[var(--tx3)]">No invoices for this type.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
