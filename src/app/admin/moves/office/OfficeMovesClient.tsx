"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import Badge from "../../components/Badge";
import { StatPctChange } from "../../components/StatPctChange";
import MoveNotifyButton from "../MoveNotifyButton";
import MoveDateFilter, { getDateRangeFromPreset } from "../../components/MoveDateFilter";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { getMoveDetailPath } from "@/lib/move-code";
import { getStatusLabel } from "@/lib/move-status";
import { ScheduleMoveItem } from "../../components/ScheduleItem";

type Move = {
  id: string;
  client_name?: string;
  from_address?: string;
  to_address?: string;
  scheduled_date?: string;
  status?: string;
  move_type?: string;
  estimate?: number;
  created_at?: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "paid", label: "Paid" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function truncateAddress(from?: string, to?: string, maxLen = 40): string {
  const f = (from || "").trim();
  const t = (to || "").trim();
  const arrow = " → ";
  if (!f && !t) return "—";
  const full = f ? (t ? `${f}${arrow}${t}` : f) : t;
  if (full.length <= maxLen) return full;
  if (!t) return f.slice(0, maxLen - 1) + "…";
  const keepFrom = f + arrow;
  if (keepFrom.length >= maxLen) return keepFrom.slice(0, maxLen - 1) + "…";
  return keepFrom + t.slice(0, maxLen - keepFrom.length - 1) + "…";
}

function priceColor(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "final_payment_received" || s === "completed") return "text-[var(--grn)]";
  if (s === "cancelled") return "text-[var(--red)]";
  return "text-[var(--gold)]";
}

const today = new Date().toISOString().slice(0, 10);

export default function OfficeMovesClient({ moves }: { moves: Move[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [moveDatePreset, setMoveDatePreset] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const dateRange = getDateRangeFromPreset(moveDatePreset);
  const dateFrom = dateRange?.from ?? "";
  const dateTo = dateRange?.to ?? "";

  const filtered = useMemo(() => {
    let list = [...moves];
    if (statusFilter) {
      list = list.filter((m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (dateFrom) list = list.filter((m) => (m.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (m.scheduled_date || "") <= dateTo);
    return list;
  }, [moves, statusFilter, dateFrom, dateTo]);

  const now = new Date();
  const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthStart = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12-01`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const totalMoves = moves.length;
  const totalMovesPrev = moves.filter((m) => {
    const d = m.scheduled_date || "";
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;
  const totalMovesThisMonth = moves.filter((m) => (m.scheduled_date || "") >= thisMonthStart).length;

  const upcomingMoves = moves.filter((m) => (m.scheduled_date || "") >= today).length;
  const upcomingPrev = (() => {
    const prevToday = new Date(now);
    prevToday.setDate(prevToday.getDate() - 30);
    const pt = prevToday.toISOString().slice(0, 10);
    return moves.filter((m) => (m.scheduled_date || "") >= pt && (m.scheduled_date || "") < today).length;
  })();

  const totalRevenue = moves.reduce((sum, m) => sum + Number(m.estimate || 0), 0);
  const totalRevenuePrev = moves
    .filter((m) => {
      const d = m.scheduled_date || "";
      return d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((sum, m) => sum + Number(m.estimate || 0), 0);

  const avgPerMove = moves.length > 0 ? totalRevenue / moves.length : 0;
  const avgPerMovePrev = totalMovesPrev > 0
    ? moves
        .filter((m) => {
          const d = m.scheduled_date || "";
          return d >= lastMonthStart && d <= lastMonthEnd;
        })
        .reduce((sum, m) => sum + Number(m.estimate || 0), 0) / totalMovesPrev
    : 0;

  const hasActiveFilters = !!(statusFilter || moveDatePreset);
  const activeFilterCount = [statusFilter, moveDatePreset].filter(Boolean).length;
  const clearFilters = () => {
    setStatusFilter("");
    setMoveDatePreset("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="mb-4"><BackButton label="Back" /></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 sm:mb-6">
        <Link href="/admin/moves/office" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Moves</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{totalMoves}</span>
            <StatPctChange current={totalMovesThisMonth} previous={totalMovesPrev} />
          </div>
        </Link>
        <Link href="/admin/moves/office" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Upcoming Moves</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">{upcomingMoves}</span>
            <StatPctChange current={upcomingMoves} previous={upcomingPrev} />
          </div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Total Revenue</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--gold)]">{formatCurrency(totalRevenue)}</span>
            <StatPctChange current={totalRevenue} previous={totalRevenuePrev} />
          </div>
        </Link>
        <Link href="/admin/moves/office" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Avg $/Move</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{formatCurrency(avgPerMove)}</span>
            <StatPctChange current={avgPerMove} previous={avgPerMovePrev} />
          </div>
        </Link>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 py-3 px-3 sm:pl-2 sm:pr-3 bg-[var(--bg)]/50 border-b border-[var(--brd)]">
          <div className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[11px] font-semibold text-[var(--tx)] touch-manipulation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] rounded-full bg-[var(--gold)] text-[#0D0D0D] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-2 flex-1">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-medium text-[var(--tx3)] shrink-0">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[100px] min-h-[36px]"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} />
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          </div>
          <Link href="/admin/moves/new" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap shrink-0">
            + New Move
          </Link>
        </div>

        {filterOpen && (
          <div className="md:hidden border-b border-[var(--brd)] bg-[var(--bg)]/80 px-3 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[var(--tx3)]">Filters</span>
              <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[12px] font-semibold">Done</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Move date</label>
                <select
                  value={moveDatePreset}
                  onChange={(e) => setMoveDatePreset(e.target.value)}
                  className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                >
                  <option value="">All dates</option>
                  <optgroup label="Days">
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="tomorrow">Tomorrow</option>
                  </optgroup>
                  <optgroup label="Weeks">
                    <option value="this_week">This week</option>
                    <option value="last_week">Last week</option>
                    <option value="next_week">Next week</option>
                  </optgroup>
                  <optgroup label="Months">
                    <option value="this_month">This month</option>
                    <option value="last_month">Last month</option>
                    <option value="next_month">Next month</option>
                  </optgroup>
                  <optgroup label="Quarter">
                    <option value="this_quarter">This quarter</option>
                    <option value="last_quarter">Last quarter</option>
                    <option value="next_quarter">Next quarter</option>
                  </optgroup>
                  <optgroup label="Years">
                    <option value="this_year">This year</option>
                    <option value="last_year">Last year</option>
                    <option value="next_year">Next year</option>
                  </optgroup>
                </select>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)]">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="divide-y divide-[var(--brd)]/50 px-4 pb-4">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">No office moves yet</div>
          ) : filtered.map((m, idx) => (
            <div key={m.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ScheduleMoveItem
                  href={getMoveDetailPath(m)}
                  leftPrimary={String(idx + 1).padStart(2, "0")}
                  leftSecondary={formatMoveDate(m.scheduled_date)}
                  status={getStatusLabel(m.status ?? null)}
                  title={m.client_name || "—"}
                  price={formatCurrency(m.estimate ?? 0)}
                  subtitle={truncateAddress(m.from_address, m.to_address)}
                />
              </div>
              <div className="shrink-0">
                <MoveNotifyButton move={m} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
