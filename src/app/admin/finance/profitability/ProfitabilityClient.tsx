"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Download, ChevronDown, ArrowUpDown, Search } from "lucide-react";

/* ════════════ types ════════════ */
interface ProfitRow {
  id: string;
  move_code: string;
  date: string;
  client: string;
  type: string;
  tier: string | null;
  revenue: number;
  neighbourhood: string | null;
  labour: number;
  fuel: number;
  truck: number;
  supplies: number;
  processing: number;
  totalDirect: number;
  allocatedOverhead: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
}

interface Summary {
  avgGrossMargin: number;
  avgNetMargin: number;
  avgProfitPerMove: number;
  lowMarginCount: number;
  totalRevenue: number;
  totalDirectCost: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  moveCount: number;
  targetMargin: number;
}

interface OverheadData {
  total: number;
  perMove: number;
  breakEven: number;
  items: Record<string, number>;
}

/* ════════════ date ranges ════════════ */
function getRange(preset: string): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(now), label: "This Month" };
    case "last_month": {
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 0);
      return { from: fmt(s), to: fmt(e), label: "Last Month" };
    }
    case "last_3":
      return { from: fmt(new Date(y, m - 2, 1)), to: fmt(now), label: "Last 3 Months" };
    case "last_6":
      return { from: fmt(new Date(y, m - 5, 1)), to: fmt(now), label: "Last 6 Months" };
    case "ytd":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(now), label: "Year to Date" };
    default:
      return { from: fmt(new Date(y, m, 1)), to: fmt(now), label: "This Month" };
  }
}

const PRESETS = [
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "last_3", label: "Last 3 Months" },
  { id: "last_6", label: "Last 6 Months" },
  { id: "ytd", label: "Year to Date" },
];

/* ════════════ helpers ════════════ */
const pct = (n: number) => `${n.toFixed(1)}%`;
const marginColor = (margin: number, target: number) =>
  margin >= target ? "text-emerald-400" : margin >= target - 5 ? "text-[var(--gold)]" : "text-red-400";
const marginBg = (margin: number, target: number) =>
  margin >= target
    ? "bg-emerald-500/10 border-emerald-500/20"
    : margin >= target - 5
      ? "bg-[var(--gold)]/10 border-[var(--gold)]/20"
      : "bg-red-500/10 border-red-500/20";

const TIER_COLORS: Record<string, string> = {
  essentials: "#6B7280",
  premier: "#C9A962",
  estate: "#2D6A4F",
};

const TYPE_LABELS: Record<string, string> = {
  local_move: "Residential",
  residential: "Residential",
  office_move: "Office",
  office: "Office",
  single_item: "Single Item",
  white_glove: "White Glove",
  specialty: "Specialty",
  b2b: "B2B",
};

/* ════════════ main component ════════════ */
export default function ProfitabilityClient() {
  const router = useRouter();
  const [preset, setPreset] = useState("this_month");
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [overhead, setOverhead] = useState<OverheadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [showOverhead, setShowOverhead] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange(preset);
    try {
      const res = await fetch(`/api/admin/profitability?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
      setOverhead(data.overhead ?? null);
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [preset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: refresh when moves or invoices are updated
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("profitability-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "moves" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, fetchData)
      .subscribe();

    // Polling fallback every 60s
    const interval = setInterval(fetchData, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchData]);

  /* ------------ derived ------------ */
  const target = summary?.targetMargin ?? 40;

  const filteredRows = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (row) =>
          (row.client ?? "").toLowerCase().includes(q) ||
          (row.move_code ?? "").toLowerCase().includes(q),
      );
    }
    r = [...r].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
    return r;
  }, [rows, search, sortKey, sortAsc]);

  const tierBreakdown = useMemo(() => {
    const m: Record<string, { count: number; totalRev: number; totalCost: number; totalGP: number }> = {};
    for (const r of rows) {
      const t = r.tier || "none";
      if (!m[t]) m[t] = { count: 0, totalRev: 0, totalCost: 0, totalGP: 0 };
      m[t].count++;
      m[t].totalRev += r.revenue;
      m[t].totalCost += r.totalDirect;
      m[t].totalGP += r.grossProfit;
    }
    return Object.entries(m)
      .filter(([k]) => k !== "none")
      .map(([tier, v]) => ({
        tier,
        moves: v.count,
        avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
        avgCost: v.count ? Math.round(v.totalCost / v.count) : 0,
        avgGP: v.count ? Math.round(v.totalGP / v.count) : 0,
        margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
      }));
  }, [rows]);

  const typeBreakdown = useMemo(() => {
    const m: Record<string, { count: number; totalRev: number; totalCost: number; totalGP: number }> = {};
    for (const r of rows) {
      const t = r.type || "other";
      if (!m[t]) m[t] = { count: 0, totalRev: 0, totalCost: 0, totalGP: 0 };
      m[t].count++;
      m[t].totalRev += r.revenue;
      m[t].totalCost += r.totalDirect;
      m[t].totalGP += r.grossProfit;
    }
    return Object.entries(m).map(([type, v]) => ({
      type,
      label: TYPE_LABELS[type] || type,
      moves: v.count,
      avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
      avgCost: v.count ? Math.round(v.totalCost / v.count) : 0,
      avgGP: v.count ? Math.round(v.totalGP / v.count) : 0,
      margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
    }));
  }, [rows]);

  const revenueSplit = useMemo(() => {
    const b2bTypes = new Set(["b2b", "b2b_delivery", "delivery"]);
    const res = { count: 0, revenue: 0, directCost: 0, gp: 0 };
    const b2b = { count: 0, revenue: 0, directCost: 0, gp: 0 };
    for (const r of rows) {
      const bucket = b2bTypes.has(r.type) ? b2b : res;
      bucket.count++;
      bucket.revenue += r.revenue;
      bucket.directCost += r.totalDirect;
      bucket.gp += r.grossProfit;
    }
    const resMargin = res.revenue > 0 ? Math.round((res.gp / res.revenue) * 1000) / 10 : 0;
    const b2bMargin = b2b.revenue > 0 ? Math.round((b2b.gp / b2b.revenue) * 1000) / 10 : 0;
    const totalRev = res.revenue + b2b.revenue;
    const totalGP = res.gp + b2b.gp;
    const blendedMargin = totalRev > 0 ? Math.round((totalGP / totalRev) * 1000) / 10 : 0;
    return { residential: { ...res, margin: resMargin }, b2b: { ...b2b, margin: b2bMargin }, combined: { revenue: totalRev, gp: totalGP, margin: blendedMargin, count: res.count + b2b.count } };
  }, [rows]);

  const neighbourhoodBreakdown = useMemo(() => {
    const m: Record<string, { count: number; totalRev: number; totalGP: number }> = {};
    for (const r of rows) {
      const n = r.neighbourhood || "N/A";
      if (!m[n]) m[n] = { count: 0, totalRev: 0, totalGP: 0 };
      m[n].count++;
      m[n].totalRev += r.revenue;
      m[n].totalGP += r.grossProfit;
    }
    return Object.entries(m)
      .map(([area, v]) => ({
        area,
        moves: v.count,
        avgRevenue: v.count ? Math.round(v.totalRev / v.count) : 0,
        avgGP: v.count ? Math.round(v.totalGP / v.count) : 0,
        margin: v.totalRev > 0 ? Math.round(((v.totalGP / v.totalRev) * 100) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.margin - a.margin);
  }, [rows]);

  const monthlyTrend = useMemo(() => {
    const m: Record<string, { totalRev: number; totalDirect: number; totalOverhead: number; count: number }> = {};
    for (const r of rows) {
      const mo = r.date?.slice(0, 7) || "unknown";
      if (!m[mo]) m[mo] = { totalRev: 0, totalDirect: 0, totalOverhead: 0, count: 0 };
      m[mo].totalRev += r.revenue;
      m[mo].totalDirect += r.totalDirect;
      m[mo].totalOverhead += r.allocatedOverhead;
      m[mo].count++;
    }
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        grossMargin: v.totalRev > 0 ? Math.round((((v.totalRev - v.totalDirect) / v.totalRev) * 100) * 10) / 10 : 0,
        netMargin: v.totalRev > 0 ? Math.round((((v.totalRev - v.totalDirect - v.totalOverhead) / v.totalRev) * 100) * 10) / 10 : 0,
        moves: v.count,
      }));
  }, [rows]);

  /* ------------ CSV export ------------ */
  const exportCSV = () => {
    const headers = [
      "Move ID", "Date", "Client", "Type", "Tier", "Revenue",
      "Labour", "Fuel", "Truck", "Supplies", "Processing",
      "Direct Cost", "Gross Profit", "Gross Margin %",
      "Overhead Alloc", "Net Profit", "Net Margin %",
    ];
    const csvRows = filteredRows.map((r) => [
      r.move_code, r.date, `"${r.client}"`, r.type, r.tier ?? "",
      r.revenue, r.labour, r.fuel, r.truck, r.supplies, r.processing,
      r.totalDirect, r.grossProfit, r.grossMargin,
      r.allocatedOverhead, r.netProfit, r.netMargin,
    ].join(","));
    const blob = new Blob([headers.join(",") + "\n" + csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profitability-${preset}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2 cursor-pointer hover:text-[var(--tx)] select-none whitespace-nowrap"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <ArrowUpDown className="w-2.5 h-2.5 opacity-40" />
      </span>
    </th>
  );

  /* ════════════ render ════════════ */
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-5 md:px-6 py-4 md:py-5 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-heading font-bold text-[var(--tx)]">Profitability</h1>
          <p className="text-[11px] text-[var(--tx3)]">Revenue, costs, and margin analysis — owner only</p>
          <Link
            href="/admin/finance/forecast"
            className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            View Revenue Forecast →
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2 py-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPreset(p.id); setVisibleCount(20); }}
                className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                  preset === p.id
                    ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                    : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--bg)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] border border-[var(--brd)] rounded-lg px-3 py-1.5 hover:bg-[var(--bg)] transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-t border-[var(--brd)]/30 pt-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ──── Top Stats ──── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 border-t border-[var(--brd)]/30 pt-5">
            <StatCard
              label="Gross Margin"
              value={pct(summary?.avgGrossMargin ?? 0)}
              sub={getRange(preset).label}
              className={marginColor(summary?.avgGrossMargin ?? 0, target)}
              bgClass={marginBg(summary?.avgGrossMargin ?? 0, target)}
              icon={(summary?.avgGrossMargin ?? 0) >= target ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            />
            <StatCard
              label="Net Margin"
              value={pct(summary?.avgNetMargin ?? 0)}
              sub="After Overhead"
              className={marginColor(summary?.avgNetMargin ?? 0, target - 10)}
              bgClass={marginBg(summary?.avgNetMargin ?? 0, target - 10)}
              icon={(summary?.avgNetMargin ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            />
            <StatCard
              label="Avg Profit Per Move"
              value={formatCurrency(summary?.avgProfitPerMove ?? 0)}
              sub={`${summary?.moveCount ?? 0} completed moves`}
              className="text-[var(--gold)]"
              bgClass="bg-[var(--gold)]/5 border-[var(--gold)]/15"
            />
            <StatCard
              label="Low Margin Alerts"
              value={String(summary?.lowMarginCount ?? 0)}
              sub="Moves below 25% gross margin"
              className={summary?.lowMarginCount ? "text-red-400" : "text-emerald-400"}
              bgClass={summary?.lowMarginCount ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"}
              icon={summary?.lowMarginCount ? <AlertTriangle className="w-4 h-4" /> : null}
            />
          </div>

          {/* ──── Revenue Split: Residential vs B2B ──── */}
          {(revenueSplit.b2b.count > 0 || revenueSplit.residential.count > 0) && (
            <div className="grid grid-cols-3 gap-3 border-t border-[var(--brd)]/30 pt-5">
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Residential Moves</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.residential.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.residential.count} moves · {pct(revenueSplit.residential.margin)} margin</div>
              </div>
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">B2B Deliveries</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.b2b.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.b2b.count} deliveries · {pct(revenueSplit.b2b.margin)} margin</div>
              </div>
              <div className="py-3 space-y-1">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Combined</div>
                <div className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(revenueSplit.combined.revenue)}</div>
                <div className="text-[11px] text-[var(--tx3)]">{revenueSplit.combined.count} total · {pct(revenueSplit.combined.margin)} blended</div>
              </div>
            </div>
          )}

          {/* ──── Profit by Tier ──── */}
          {tierBreakdown.length > 0 && (
            <Section title="Profit by Tier">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-56 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierBreakdown} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" />
                      <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--brd)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v) => [formatCurrency(Number(v ?? 0)), "Avg Gross Profit"]}
                      />
                      <Bar dataKey="avgGP" radius={[4, 4, 0, 0]}>
                        {tierBreakdown.map((entry) => (
                          <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] || "#C9A962"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Tier</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Moves</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Revenue</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Cost</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Profit</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierBreakdown.map((t) => (
                        <tr key={t.tier} className="border-t border-[var(--brd)]/50">
                          <td className="py-1.5 px-2 capitalize font-medium text-[var(--tx)]">{t.tier}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{t.moves}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgRevenue)}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgCost)}</td>
                          <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(t.avgGP)}</td>
                          <td className={`py-1.5 px-2 font-semibold ${marginColor(t.margin, target)}`}>{pct(t.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}

          {/* ──── Profit by Move Type ──── */}
          {typeBreakdown.length > 0 && (
            <Section title="Profit by Move Type">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-56 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeBreakdown} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--brd)", borderRadius: 8, fontSize: 11 }}
                        formatter={(v) => [formatCurrency(Number(v ?? 0)), "Avg Gross Profit"]}
                      />
                      <Bar dataKey="avgGP" fill="#C9A962" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Type</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Moves</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Revenue</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Cost</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Profit</th>
                        <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeBreakdown.map((t) => (
                        <tr key={t.type} className="border-t border-[var(--brd)]/50">
                          <td className="py-1.5 px-2 font-medium text-[var(--tx)]">{t.label}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{t.moves}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgRevenue)}</td>
                          <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(t.avgCost)}</td>
                          <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(t.avgGP)}</td>
                          <td className={`py-1.5 px-2 font-semibold ${marginColor(t.margin, target)}`}>{pct(t.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}

          {/* ──── Profit by Neighbourhood ──── */}
          {neighbourhoodBreakdown.length > 0 && (
            <Section title="Profit by Neighbourhood">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Area (FSA)</th>
                      <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Moves</th>
                      <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Revenue</th>
                      <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Avg Gross Profit</th>
                      <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {neighbourhoodBreakdown.slice(0, 15).map((n) => (
                      <tr key={n.area} className="border-t border-[var(--brd)]/50">
                        <td className="py-1.5 px-2 font-mono font-medium text-[var(--tx)]">{n.area}</td>
                        <td className="py-1.5 px-2 text-[var(--tx2)]">{n.moves}</td>
                        <td className="py-1.5 px-2 text-[var(--tx2)]">{formatCurrency(n.avgRevenue)}</td>
                        <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(n.avgGP)}</td>
                        <td className={`py-1.5 px-2 font-semibold ${marginColor(n.margin, target)}`}>{pct(n.margin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* ──── Monthly Trend ──── */}
          {monthlyTrend.length > 1 && (
            <Section title="Monthly Trend">
              <div className="h-64 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--brd)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--tx3)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--brd)", borderRadius: 8, fontSize: 11 }}
                      formatter={(v, name) => [`${Number(v ?? 0)}%`, name === "grossMargin" ? "Gross Margin" : "Net Margin"]}
                    />
                    <Line type="monotone" dataKey="grossMargin" stroke="#C9A962" strokeWidth={2} dot={{ r: 3 }} name="grossMargin" />
                    <Line type="monotone" dataKey="netMargin" stroke="#2D6A4F" strokeWidth={2} dot={{ r: 3 }} name="netMargin" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--tx3)]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#C9A962] rounded" />Gross Margin</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#2D6A4F] rounded" />Net Margin</span>
              </div>
            </Section>
          )}

          {/* ──── Per-Move Profit Table ──── */}
          <Section title="Per-Move Profit Table">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--tx3)]" />
                <input
                  type="text"
                  placeholder="Search by client or move ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[var(--tx)] placeholder:text-[var(--tx3)] outline-none focus:border-[var(--brd)]"
                />
              </div>
              <span className="text-[10px] text-[var(--tx3)]">{filteredRows.length} moves</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <SortHeader label="Move" field="move_code" />
                    <SortHeader label="Date" field="date" />
                    <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Client</th>
                    <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Type</th>
                    <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2 px-2">Tier</th>
                    <SortHeader label="Revenue" field="revenue" />
                    <SortHeader label="Labour" field="labour" />
                    <SortHeader label="Fuel" field="fuel" />
                    <SortHeader label="Truck" field="truck" />
                    <SortHeader label="Supplies" field="supplies" />
                    <SortHeader label="Processing" field="processing" />
                    <SortHeader label="Direct Cost" field="totalDirect" />
                    <SortHeader label="Gross Profit" field="grossProfit" />
                    <SortHeader label="Margin" field="grossMargin" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.slice(0, visibleCount).map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => router.push(`/admin/moves/${r.move_code || r.id}`)}
                      className={`border-t border-[var(--brd)]/50 cursor-pointer hover:bg-[var(--bg)] transition-colors ${
                        r.grossMargin < 25
                          ? "border-l-2 border-l-red-500/60"
                          : r.grossMargin > 60
                            ? "border-l-2 border-l-emerald-500/60"
                            : ""
                      }`}
                    >
                      <td className="py-1.5 px-2 font-mono text-[10px] text-[var(--tx2)]">{r.move_code || r.id.slice(0, 8)}</td>
                      <td className="py-1.5 px-2 text-[var(--tx3)]">{r.date}</td>
                      <td className="py-1.5 px-2 font-medium text-[var(--tx)] max-w-[120px] truncate">{r.client}</td>
                      <td className="py-1.5 px-2 text-[var(--tx3)]">{TYPE_LABELS[r.type] || r.type}</td>
                      <td className="py-1.5 px-2 capitalize text-[var(--tx3)]">{r.tier || "—"}</td>
                      <td className="py-1.5 px-2 font-medium text-[var(--tx)]">{formatCurrency(r.revenue)}</td>
                      <td className="py-1.5 px-2 text-red-400/80">{formatCurrency(r.labour)}</td>
                      <td className="py-1.5 px-2 text-red-400/80">{formatCurrency(r.fuel)}</td>
                      <td className="py-1.5 px-2 text-red-400/80">{formatCurrency(r.truck)}</td>
                      <td className="py-1.5 px-2 text-red-400/80">{formatCurrency(r.supplies)}</td>
                      <td className="py-1.5 px-2 text-red-400/80">{formatCurrency(r.processing)}</td>
                      <td className="py-1.5 px-2 font-medium text-red-400">{formatCurrency(r.totalDirect)}</td>
                      <td className="py-1.5 px-2 font-medium text-emerald-400">{formatCurrency(r.grossProfit)}</td>
                      <td className={`py-1.5 px-2 font-bold ${marginColor(r.grossMargin, target)}`}>{pct(r.grossMargin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleCount < filteredRows.length && (
              <div className="text-center pt-3">
                <button
                  onClick={() => setVisibleCount((c) => c + 20)}
                  className="text-[11px] font-medium text-[var(--gold)] hover:text-[var(--gold2)] transition-colors"
                >
                  Load More ({filteredRows.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </Section>

          {/* ──── Overhead Summary ──── */}
          {overhead && (
            <div className="border-t border-[var(--brd)]/30 pt-5">
              <button
                onClick={() => setShowOverhead(!showOverhead)}
                className="w-full flex items-center justify-between py-3 hover:bg-[var(--bg2)]/30 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Monthly Overhead</span>
                  <span className="text-[11px] text-[var(--tx3)]">{formatCurrency(overhead.total)}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--tx3)] transition-transform ${showOverhead ? "rotate-180" : ""}`} />
              </button>
              {showOverhead && (
                <div className="pt-4 pb-2 space-y-2 text-[11px] border-t border-[var(--brd)]/30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1.5 py-3">
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Software</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.software)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Auto Insurance</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.autoInsurance)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">GL Insurance</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.glInsurance)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Marketing</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.marketing)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Office / Admin</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.officeAdmin)}</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Owner Draw</span><span className="text-[var(--tx)]">{formatCurrency(overhead.items.ownerDraw)}</span></div>
                  </div>
                  <div className="border-t border-[var(--brd)]/50 pt-2 space-y-1">
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Per-Move Overhead Allocation</span><span className="text-[var(--tx)] font-medium">{formatCurrency(overhead.perMove)} ({summary?.moveCount ?? 0} moves this period)</span></div>
                    <div className="flex justify-between"><span className="text-[var(--tx3)]">Break-Even</span><span className="text-[var(--gold)] font-medium">{overhead.breakEven} moves/month at current avg revenue</span></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════ sub-components ════════════ */
function StatCard({
  label,
  value,
  sub,
  className,
  bgClass,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  className: string;
  bgClass: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">{label}</span>
        {icon && <span className={className}>{icon}</span>}
      </div>
      <div className={`text-2xl font-heading font-bold ${className}`}>{value}</div>
      <div className="text-[10px] text-[var(--tx3)] mt-0.5">{sub}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <h2 className="text-[13px] font-bold text-[var(--tx)] mb-4">{title}</h2>
      {children}
    </div>
  );
}
