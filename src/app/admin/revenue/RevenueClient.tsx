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
  Cell,
} from "recharts";
import BackButton from "../components/BackButton";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";
import { TrendUp as TrendingUp, TrendDown as TrendingDown, Minus, ArrowUpRight, X } from "@phosphor-icons/react";

type Period = "6mo" | "year" | "ytd" | "monthly" | "all";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "6mo", label: "6 Mo" },
  { key: "ytd", label: "YTD" },
  { key: "year", label: "12 Mo" },
  { key: "all", label: "All Time" },
  { key: "monthly", label: "Daily" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Invoice {
  id: string;
  client_name: string | null;
  organization_id: string | null;
  amount: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  invoice_number: string | null;
}

interface PaidMove {
  id: string;
  move_code: string | null;
  client_name: string | null;
  estimate: number | null;
  payment_marked_paid_at: string | null;
}

interface RevenueClientProps {
  invoices: Invoice[];
  paidMoves?: PaidMove[];
  clientTypeMap?: Record<string, string>;
  clientNameToOrgId?: Record<string, string>;
}

function getInvoiceRevenueDate(inv: Invoice): Date {
  const ts = inv.updated_at || inv.created_at;
  return ts ? new Date(ts) : new Date(0);
}

function getMoveRevenueDate(m: PaidMove): Date {
  const ts = m.payment_marked_paid_at;
  return ts ? new Date(ts) : new Date(0);
}

// ─── Section Divider ────────────────────────────────────────────────────────
function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-[var(--brd)] my-8" />;
  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--brd)]" />
      </div>
      <div className="relative flex justify-start">
        <span className="bg-[var(--bg)] pr-4 text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 select-none">
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  delta,
  href,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className="group cursor-default">
      <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/60 mb-2">
        {label}
      </p>
      <p
        className={`text-[28px] font-bold font-heading leading-none ${
          accent ? "text-[var(--grn)]" : "text-[var(--tx)]"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[9px] text-[var(--tx3)] mt-1.5">{sub}</p>}
      {delta !== undefined && delta !== 0 && (
        <div
          className={`inline-flex items-center gap-1 mt-2 text-[10px] font-semibold ${
            delta >= 0 ? "text-[var(--grn)]" : "text-red-500"
          }`}
        >
          {delta >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {delta >= 0 ? "+" : ""}
          {delta}% vs prev
        </div>
      )}
      {delta === 0 && (
        <div className="inline-flex items-center gap-1 mt-2 text-[10px] text-[var(--tx3)]">
          <Minus className="w-3 h-3" />
          No change
        </div>
      )}
    </div>
  );
  if (href)
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {inner}
      </Link>
    );
  return inner;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label: _label }: { active?: boolean; payload?: { value: number; payload?: { fullLabel?: string } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const fullLabel = p?.payload?.fullLabel ?? _label;
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl px-3.5 py-2.5 shadow-xl text-[11px]">
      <p className="text-[var(--tx3)] mb-1 font-medium">{fullLabel}</p>
      <p className="font-bold text-[var(--tx)]">{formatCurrency(p.value ?? 0)}</p>
    </div>
  );
}

// ─── Source Pill ─────────────────────────────────────────────────────────────
function SourcePill({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-1.5 h-7 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-[var(--tx2)]">{label}</span>
          <span className="text-[11px] font-bold text-[var(--tx)]">{formatCurrency(value)}</span>
        </div>
        <div className="h-[3px] bg-[var(--brd)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
      <span className="text-[10px] font-bold text-[var(--tx3)] w-8 text-right shrink-0">
        {pct}%
      </span>
    </div>
  );
}

export default function RevenueClient({
  invoices,
  paidMoves = [],
  clientTypeMap = {},
  clientNameToOrgId = {},
}: RevenueClientProps) {
  const [period, setPeriod] = useState<Period>("6mo");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const handlePeriodChange = (key: Period) => {
    setSelectedYear(null);
    setPeriod(key);
  };
  const handleYearSelect = (y: number) => {
    setSelectedYear(y);
    setPeriod("year");
  };

  const all = invoices || [];
  const paid = all.filter((i) => i.status === "paid");
  const paidMovesList = paidMoves || [];

  const invoiceRevenue = paid.reduce((s, i) => s + Number(i.amount), 0);
  const moveRevenue = paidMovesList.reduce((s, m) => s + Number(m.estimate || 0), 0);
  const paidTotal = invoiceRevenue + moveRevenue;
  const totalSource = Math.max(1, invoiceRevenue + moveRevenue);
  const invPct = Math.round((invoiceRevenue / totalSource) * 100);
  const movePct = 100 - invPct;

  const outstanding = all
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.amount), 0);

  const byClient: Record<string, number> = {};
  paid.forEach((i) => {
    const name = i.client_name ?? "-";
    byClient[name] = (byClient[name] || 0) + Number(i.amount);
  });
  paidMovesList.forEach((m) => {
    const name = m.client_name || "-";
    byClient[name] = (byClient[name] || 0) + Number(m.estimate || 0);
  });
  const topClients = Object.entries(byClient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxClientAmount = Math.max(1, topClients[0]?.[1] ?? 1);

  const chartData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // All Time: aggregate by year
    if (period === "all") {
      const byYear: Record<number, number> = {};
      paid.forEach((inv) => {
        const y = getInvoiceRevenueDate(inv).getFullYear();
        byYear[y] = (byYear[y] || 0) + Number(inv.amount);
      });
      paidMovesList.forEach((m) => {
        const y = getMoveRevenueDate(m).getFullYear();
        byYear[y] = (byYear[y] || 0) + Number(m.estimate || 0);
      });
      const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
      return years.map((y) => ({
        label: String(y),
        value: byYear[y] || 0,
        fullLabel: String(y),
      }));
    }

    // Specific year selected: monthly breakdown for that year
    if (selectedYear !== null) {
      const result: { label: string; value: number; fullLabel: string }[] = [];
      for (let m = 0; m < 12; m++) {
        let sum = 0;
        paid.forEach((inv) => {
          const d = getInvoiceRevenueDate(inv);
          if (d.getFullYear() === selectedYear && d.getMonth() === m) sum += Number(inv.amount);
        });
        paidMovesList.forEach((move) => {
          const d = getMoveRevenueDate(move);
          if (d.getFullYear() === selectedYear && d.getMonth() === m) sum += Number(move.estimate || 0);
        });
        result.push({ label: MONTH_LABELS[m], value: sum, fullLabel: `${MONTH_LABELS[m]} ${selectedYear}` });
      }
      return result;
    }

    if (period === "monthly") {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const byDay: Record<number, number> = {};
      for (let d = 1; d <= daysInMonth; d++) byDay[d] = 0;
      paid.forEach((inv) => {
        const d = getInvoiceRevenueDate(inv);
        if (d.getFullYear() === year && d.getMonth() === month) {
          byDay[d.getDate()] = (byDay[d.getDate()] || 0) + Number(inv.amount);
        }
      });
      paidMovesList.forEach((m) => {
        const d = getMoveRevenueDate(m);
        if (d.getFullYear() === year && d.getMonth() === month) {
          byDay[d.getDate()] = (byDay[d.getDate()] || 0) + Number(m.estimate || 0);
        }
      });
      return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return {
          label: String(day),
          value: byDay[day] || 0,
          fullLabel: `${now.toLocaleString("en-US", { month: "short" })} ${day}`,
        };
      });
    }

    const monthsToShow = period === "6mo" ? 6 : period === "ytd" ? month + 1 : 12;
    const startMonth = period === "6mo" ? month - 5 : 0;
    const result: { label: string; value: number; fullLabel: string }[] = [];

    for (let i = 0; i < monthsToShow; i++) {
      let m = startMonth + i;
      let y = year;
      if (m < 0) { m += 12; y -= 1; }
      else if (m >= 12) { m -= 12; y += 1; }
      let sum = 0;
      paid.forEach((inv) => {
        const d = getInvoiceRevenueDate(inv);
        if (d.getFullYear() === y && d.getMonth() === m) sum += Number(inv.amount);
      });
      paidMovesList.forEach((move) => {
        const d = getMoveRevenueDate(move);
        if (d.getFullYear() === y && d.getMonth() === m) sum += Number(move.estimate || 0);
      });
      result.push({ label: MONTH_LABELS[m], value: sum, fullLabel: `${MONTH_LABELS[m]} ${y}` });
    }
    return result;
  }, [period, selectedYear, paid, paidMovesList]);

  const byTypeRaw: Record<string, number> = {};
  paid.forEach((i) => {
    const t = (i.client_name ? clientTypeMap[i.client_name] : undefined) || "retail";
    byTypeRaw[t] = (byTypeRaw[t] || 0) + Number(i.amount);
  });
  const byType = [
    { key: "retail",      label: "Retail",      amount: byTypeRaw.retail      || 0, color: "var(--gold)" },
    { key: "designer",    label: "Designer",     amount: byTypeRaw.designer    || 0, color: "#a78bfa" },
    { key: "hospitality", label: "Hospitality",  amount: byTypeRaw.hospitality || 0, color: "var(--grn)" },
    { key: "gallery",     label: "Gallery",      amount: byTypeRaw.gallery     || 0, color: "#60a5fa" },
    { key: "realtor",     label: "Realtor",      amount: byTypeRaw.realtor     || 0, color: "#f472b6" },
    { key: "b2c",         label: "B2C Moves",    amount: byTypeRaw.b2c         || 0, color: "var(--tx3)" },
  ];
  const maxByType = Math.max(1, ...byType.map((t) => t.amount));
  const totalByType = byType.reduce((s, t) => s + t.amount, 0) || 1;

  const invoicesByType = useMemo(() => {
    if (!selectedType) return [];
    return all.filter((i) => ((i.client_name ? clientTypeMap[i.client_name] : undefined) || "retail") === selectedType);
  }, [all, selectedType, clientTypeMap]);

  const now = new Date();
  const currentMonthRevenue = useMemo(() => {
    const y = now.getFullYear(); const m = now.getMonth();
    const invSum = paid.filter((inv) => { const d = getInvoiceRevenueDate(inv); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, i) => s + Number(i.amount), 0);
    const moveSum = paidMovesList.filter((move) => { const d = getMoveRevenueDate(move); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, m) => s + Number(m.estimate || 0), 0);
    return invSum + moveSum;
  }, [paid, paidMovesList, now]);

  const prevMonthRevenue = useMemo(() => {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = prev.getFullYear(); const m = prev.getMonth();
    const invSum = paid.filter((inv) => { const d = getInvoiceRevenueDate(inv); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, i) => s + Number(i.amount), 0);
    const moveSum = paidMovesList.filter((move) => { const d = getMoveRevenueDate(move); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, m) => s + Number(m.estimate || 0), 0);
    return invSum + moveSum;
  }, [paid, paidMovesList, now]);

  const ytdRevenue = useMemo(() => {
    const y = now.getFullYear();
    const invSum = paid.filter((inv) => getInvoiceRevenueDate(inv).getFullYear() === y).reduce((s, i) => s + Number(i.amount), 0);
    const moveSum = paidMovesList.filter((move) => getMoveRevenueDate(move).getFullYear() === y).reduce((s, m) => s + Number(m.estimate || 0), 0);
    return invSum + moveSum;
  }, [paid, paidMovesList, now]);

  const totalPaidItems = paid.length + paidMovesList.length;
  const avgJob = totalPaidItems > 0 ? Math.round(paidTotal / totalPaidItems) : 0;
  const pctChange = prevMonthRevenue > 0
    ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
    : currentMonthRevenue > 0 ? 100 : 0;
  const currentMonthLabel = now.toLocaleString("en-US", { month: "long" });

  // Chart max for bar highlight
  const chartMax = Math.max(1, ...chartData.map((d) => d.value));

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 md:px-8 py-6 md:py-8 animate-fade-up">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <BackButton label="Back" />
      </div>
      <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/50 mb-1">
            Financial Overview
          </p>
          <h1 className="font-heading text-[26px] font-bold text-[var(--tx)] leading-none">
            Revenue
          </h1>
        </div>
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-[var(--gold)] hover:opacity-70 transition-opacity"
        >
          All Invoices <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── Section 1: KPI Summary ─────────────────────────────────────────── */}
      <SectionDivider label="Summary" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
        <KpiCard
          label={`${currentMonthLabel} Revenue`}
          value={formatCompactCurrency(currentMonthRevenue)}
          sub="Before HST"
          delta={pctChange}
          href="/admin/invoices"
          accent
        />
        <KpiCard
          label={`${now.getFullYear()} YTD`}
          value={formatCompactCurrency(ytdRevenue)}
          sub={`${paid.length + paidMovesList.length} paid jobs`}
          href="/admin/invoices"
        />
        <KpiCard
          label="Outstanding"
          value={formatCompactCurrency(outstanding)}
          sub="Sent + overdue"
          href="/admin/invoices"
        />
        <KpiCard
          label="Avg Job Value"
          value={formatCompactCurrency(avgJob)}
          sub={`Across ${totalPaidItems} jobs`}
        />
      </div>

      {/* ── Section 2: Revenue by Source ──────────────────────────────────── */}
      {(invoiceRevenue > 0 || moveRevenue > 0) && (
        <>
          <SectionDivider label="Revenue by Source" />
          <div className="grid sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--brd)]">
            <div className="sm:pr-8 pb-4 sm:pb-0">
              <SourcePill
                color="var(--gold)"
                label="Invoice Payments"
                value={invoiceRevenue}
                pct={invPct}
              />
              <SourcePill
                color="var(--grn)"
                label="Move Payments"
                value={moveRevenue}
                pct={movePct}
              />
            </div>
            <div className="sm:pl-8 pt-4 sm:pt-0 flex flex-col justify-center">
              <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/60 mb-1">
                Combined
              </p>
              <p className="text-[32px] font-bold font-heading text-[var(--tx)] leading-none">
                {formatCompactCurrency(paidTotal)}
              </p>
              <p className="text-[10px] text-[var(--tx3)] mt-1.5">
                {totalPaidItems} paid transactions
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Section 3: Revenue Trend Chart ────────────────────────────────── */}
      <SectionDivider label="Revenue Trend" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="admin-section-h2">
            {period === "monthly"
              ? now.toLocaleString("en-US", { month: "long", year: "numeric" })
              : period === "ytd"
              ? `Jan – ${currentMonthLabel} ${now.getFullYear()}`
              : period === "6mo"
              ? "Last 6 Months"
              : period === "all"
              ? "All Time"
              : selectedYear !== null
              ? `${selectedYear}`
              : "12-Month View"}
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1">
          <div className="flex shrink-0 gap-0.5 p-0.5 bg-[var(--card)] border border-[var(--brd)] rounded-full">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handlePeriodChange(opt.key)}
                className={`px-3.5 py-2 md:py-1.5 rounded-full text-[10px] font-bold tracking-wide transition-all duration-200 touch-manipulation ${
                  period === opt.key && selectedYear === null
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm"
                    : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 gap-0.5 p-0.5 bg-[var(--card)] border border-[var(--brd)] rounded-full">
            {YEAR_OPTIONS.map((y) => (
              <button
                key={y}
                onClick={() => handleYearSelect(y)}
                className={`px-3 py-2 md:py-1.5 rounded-full text-[10px] font-bold tracking-wide transition-all duration-200 touch-manipulation ${
                  selectedYear === y
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm"
                    : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[220px] w-full min-w-0">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              onMouseLeave={() => setHoveredBar(null)}
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
                tickFormatter={(v) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v}`)}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(201,169,98,0.06)" }} />
              <Bar
                dataKey="value"
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                onMouseEnter={(_, index) => setHoveredBar(index)}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.value === chartMax && chartMax > 0
                        ? "var(--gold)"
                        : hoveredBar === index
                        ? "rgba(201,169,98,0.75)"
                        : "rgba(201,169,98,0.35)"
                    }
                    stroke={entry.value === chartMax && chartMax > 0 ? "var(--gold)" : "rgba(201,169,98,0.5)"}
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-[var(--tx3)] text-center max-w-[280px]">
              No revenue in this period. Revenue appears when invoices or moves are marked paid.
            </p>
          </div>
        )}
      </div>

      {/* ── Section 4: By Type + Top Clients ──────────────────────────────── */}
      <SectionDivider label="Breakdown" />

      <div className="grid md:grid-cols-2 gap-10 md:gap-14">

        {/* By Service Type */}
        <div>
          <div className="mb-5">
            <h2 className="admin-section-h2">By Service Type</h2>
            <p className="text-[10px] text-[var(--tx3)] mt-0.5">Invoice revenue by client category</p>
          </div>
          <div className="space-y-1 divide-y divide-[var(--brd)]">
            {byType.map((t) => {
              const pct = Math.round((t.amount / totalByType) * 100);
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedType(t.key)}
                  className="block w-full text-left group py-3 px-2 -mx-2 rounded-lg hover:bg-[var(--gdim)] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: t.amount > 0 ? t.color : "var(--brd)" }}
                      />
                      <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
                        {t.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.amount > 0 && (
                        <span className="text-[9px] text-[var(--tx3)]">{pct}%</span>
                      )}
                      <span className="text-[11px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
                        {formatCurrency(t.amount)}
                      </span>
                      <ArrowUpRight className="w-3 h-3 text-[var(--tx3)]/30 group-hover:text-[var(--gold)]/60 transition-colors shrink-0" aria-hidden />
                    </div>
                  </div>
                  <div className="h-[3px] bg-[var(--brd)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 group-hover:opacity-80"
                      style={{
                        width: `${(t.amount / maxByType) * 100}%`,
                        background: t.amount > 0 ? t.color : "transparent",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Clients */}
        <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="admin-section-h2">Top Clients</h2>
              <p className="text-[10px] text-[var(--tx3)] mt-0.5">Ranked by lifetime revenue</p>
            </div>
            <Link
              href="/admin/clients"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--gold)] hover:opacity-70 transition-opacity"
            >
              All clients <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-0 divide-y divide-[var(--brd)]">
            {topClients.length > 0 ? (
              topClients.map(([name, amount], idx) => {
                const orgId = clientNameToOrgId[name];
                const href = orgId ? `/admin/clients/${orgId}/revenue` : "/admin/clients";
                const barPct = Math.round((amount / maxClientAmount) * 100);
                return (
                  <Link
                    key={name}
                    href={href}
                    className="group flex items-center gap-4 py-3 hover:bg-[var(--gdim)] -mx-3 px-3 rounded-lg transition-colors"
                  >
                    <span className="text-[10px] font-bold text-[var(--tx3)] w-4 shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors truncate pr-3">
                          {name}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors shrink-0">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                      <div className="h-[3px] bg-[var(--brd)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--gold)]/50 group-hover:bg-[var(--gold)] rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })
            ) : (
              <p className="text-[11px] text-[var(--tx3)] py-6">
                No paid invoices or moves yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Invoices by Type ────────────────────────────────────────── */}
      {selectedType != null && (
        <div className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center p-4" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedType(null)}
            aria-hidden="true"
          />
          <div
            className="relative bg-[var(--card)] border border-[var(--brd)] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--brd)] shrink-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: byType.find((t) => t.key === selectedType)?.color ?? "var(--gold)" }}
                />
                <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">
                  {byType.find((t) => t.key === selectedType)?.label ?? selectedType}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:outline-none"
                >
                  {byType.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSelectedType(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--bg)] hover:bg-[var(--brd)] transition-colors text-[var(--tx3)] hover:text-[var(--tx)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {invoicesByType.length > 0 ? (
                <ul className="space-y-0 divide-y divide-[var(--brd)]">
                  {invoicesByType.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between py-2.5 gap-3 text-[11px]"
                    >
                      <span className="font-mono font-semibold text-[var(--tx3)] text-[10px] w-20 shrink-0">
                        {inv.invoice_number}
                      </span>
                      <span className="flex-1 text-[var(--tx2)] truncate">{inv.client_name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                          inv.status === "paid"
                            ? "bg-[var(--grn)]/15 text-[var(--grn)]"
                            : inv.status === "overdue"
                            ? "bg-red-500/15 text-red-500"
                            : "bg-[var(--gold)]/15 text-[var(--gold)]"
                        }`}
                      >
                        {inv.status}
                      </span>
                      <span className="font-bold text-[var(--tx)] shrink-0">{formatCurrency(inv.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[var(--tx3)] py-8 text-center">
                  No invoices for this category.
                </p>
              )}
            </div>

            {/* Modal footer total */}
            {invoicesByType.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--brd)] shrink-0">
                <span className="text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)]">
                  {invoicesByType.length} invoice{invoicesByType.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[13px] font-bold text-[var(--tx)]">
                  {formatCurrency(invoicesByType.reduce((s, i) => s + Number(i.amount), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
