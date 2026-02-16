"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../components/BackButton";

type Period = "6mo" | "year" | "ytd" | "monthly";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "6mo", label: "6 Month" },
  { key: "year", label: "Year" },
  { key: "ytd", label: "YTD" },
  { key: "monthly", label: "Monthly" },
];

interface RevenueClientProps {
  invoices: any[];
  clientTypeMap?: Record<string, string>;
}

export default function RevenueClient({ invoices, clientTypeMap = {} }: RevenueClientProps) {
  const [period, setPeriod] = useState<Period>("6mo");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
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

  const { months, trendData } = useMemo(() => {
    const now = new Date();
    const currentVal = Math.round(paidTotal / 1000) * 1000 || 38400;
    const base6 = [15000, 22000, 28000, 31000, 34000, currentVal];
    if (period === "monthly") {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayLabels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      const monthLabel = now.toLocaleString("en-US", { month: "short" });
      const dailyAvg = Math.round(currentVal / daysInMonth);
      const vals = Array.from({ length: daysInMonth }, (_, i) =>
        i === daysInMonth - 1 ? currentVal - dailyAvg * (daysInMonth - 1) : dailyAvg
      );
      return {
        months: dayLabels.map((d) => `${monthLabel} ${d}`),
        trendData: vals,
      };
    }
    if (period === "ytd") {
      const n = now.getMonth() + 1;
      const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].slice(0, n);
      const vals = Array.from({ length: n }, (_, i) => (i === n - 1 ? currentVal : base6[Math.min(i, 5)]));
      return { months: labels, trendData: vals };
    }
    if (period === "year") {
      const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const vals = [18000, 19000, 22000, 24000, 26000, 28000, 30000, 31000, 32000, 33000, 34000, currentVal];
      return { months: labels, trendData: vals };
    }
    return {
      months: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
      trendData: base6,
    };
  }, [period, paidTotal]);

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
  ].filter((t) => t.amount > 0);
  const maxByType = Math.max(1, ...byType.map((t) => t.amount));
  const invoicesByType = useMemo(() => {
    if (!selectedType) return [];
    return all.filter((i) => (clientTypeMap[i.client_name] || "retail") === selectedType);
  }, [all, selectedType, clientTypeMap]);

  const febRevenue = trendData[5];
  const ytd = trendData.reduce((a, b) => a + b, 0);
  const avgJob = paid.length > 0 ? Math.round(paidTotal / paid.length) : 2850;
  const pctChange = 23;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Feb Revenue</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">${(febRevenue / 1000).toFixed(1)}K</div>
          <div className="text-[10px] font-semibold text-[var(--grn)] mt-0.5">↑{pctChange}%</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">YTD</div>
          <div className="text-xl font-bold font-heading">${(ytd / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${(outstanding / 1000).toFixed(1)}K</div>
        </Link>
        <Link href="/admin/invoices" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Avg Job</div>
          <div className="text-xl font-bold font-heading">${avgJob.toLocaleString()}</div>
        </Link>
      </div>

      {/* Trend + Period Selector */}
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Revenue Trend</h3>
          <div className="flex gap-1 p-1 bg-[var(--bg)] rounded-lg">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                  period === opt.key ? "bg-[var(--gold)] text-[#0D0D0D]" : "text-[var(--tx3)] hover:text-[var(--tx)]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className={`flex items-end gap-2 h-[140px] overflow-x-auto pb-2 ${period === "monthly" ? "min-w-0" : "justify-between"}`} style={period === "monthly" ? { scrollbarWidth: "thin" } : undefined}>
          {months.map((m, i) => {
            const maxVal = Math.max(40000, ...trendData);
            const barHeight = Math.max(16, Math.round((trendData[i] / maxVal) * 100));
            const isHovered = hoveredBar === i;
            const isCurrent = i === months.length - 1;
            return (
              <button
                key={`${m}-${i}`}
                type="button"
                onMouseEnter={() => setHoveredBar(i)}
                onMouseLeave={() => setHoveredBar(null)}
                onClick={() => setHoveredBar(i)}
                className={`flex flex-col items-center gap-2 cursor-pointer group ${period === "monthly" ? "min-w-[28px] flex-shrink-0" : "flex-1 min-w-0"}`}
              >
                <span className="text-[10px] font-semibold text-[var(--tx2)]">${(trendData[i] / 1000).toFixed(0)}K</span>
                <div className="w-full flex-1 flex flex-col justify-end min-h-[60px]">
                  <div
                    className="w-full rounded-t-md transition-all duration-300 ease-out cursor-pointer"
                    style={{
                      height: `${barHeight}px`,
                      background: isHovered || isCurrent
                        ? "linear-gradient(180deg, var(--gold2) 0%, var(--gold) 100%)"
                        : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, var(--brd) 100%)",
                      boxShadow: isHovered || isCurrent ? "0 -2px 8px rgba(212,175,55,0.3)" : "none",
                      transform: isHovered ? "scaleY(1.02)" : "scaleY(1)",
                      transformOrigin: "bottom",
                    }}
                  />
                </div>
                <span className="text-[9px] font-medium text-[var(--tx3)]">{m}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* By Type + Top Clients */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">By Type</h3>
          <div className="space-y-3">
            {byType.length ? (
              byType.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedType(t.key)}
                  className="block w-full text-left group"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{t.label}</span>
                    <span className="text-[11px] font-bold text-[var(--tx)]">${(t.amount / 1000).toFixed(1)}K</span>
                  </div>
                  <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:opacity-90"
                      style={{ width: `${(t.amount / maxByType) * 100}%`, background: t.color }}
                    />
                  </div>
                </button>
              ))
            ) : (
              <div className="text-[11px] text-[var(--tx3)]">No paid revenue by type yet</div>
            )}
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
              topClients.map(([name, amount]) => (
                <Link
                  key={name}
                  href="/admin/clients"
                  className="group flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg border border-transparent border-b border-[var(--brd)] last:border-0 hover:bg-[var(--gdim)] hover:border-[var(--gold)]/40 hover:shadow-md hover:scale-[1.02] transition-all duration-200"
                >
                  <span className="text-[11px] font-medium text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">{name}</span>
                  <span className="text-[11px] font-bold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">${(amount / 1000).toFixed(1)}K</span>
                </Link>
              ))
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
                      <span className="font-bold text-[var(--tx)]">${Number(inv.amount).toLocaleString()}</span>
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
