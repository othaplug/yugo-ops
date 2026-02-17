"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import Badge from "../../components/Badge";
import { Icon } from "@/components/AppIcons";
import MoveNotifyButton from "../MoveNotifyButton";
import { formatMoveDate } from "@/lib/date-format";

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

export default function ResidentialMovesClient({ moves }: { moves: Move[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = [...moves];
    if (statusFilter) {
      list = list.filter((m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (dateFrom) {
      list = list.filter((m) => (m.scheduled_date || "") >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((m) => (m.scheduled_date || "") <= dateTo);
    }
    return list;
  }, [moves, statusFilter, dateFrom, dateTo]);

  const confirmed = filtered.filter((m) => m.status === "confirmed").length;
  const pipeline = filtered.reduce((sum, m) => sum + Number(m.estimate || 0), 0);

  const hasActiveFilters = !!(statusFilter || dateFrom || dateTo);
  const activeFilterCount = [statusFilter, dateFrom, dateTo].filter(Boolean).length;
  const clearFilters = () => {
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="mb-4"><BackButton label="Back" /></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 sm:mb-6">
        <Link href="/admin/moves/residential" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Residential Moves</div>
          <div className="text-xl font-bold font-heading">{filtered.length}</div>
        </Link>
        <Link href="/admin/moves/residential" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Confirmed</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{confirmed}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Pipeline</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">${pipeline.toLocaleString()}</div>
        </Link>
        <Link href="/admin/moves/new" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3 hover:border-[var(--gold)] transition-all flex items-center justify-center">
          <span className="text-[10px] font-semibold text-[var(--gold)]">+ New Move</span>
        </Link>
      </div>

      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {/* Desktop: full filter row. Mobile: single Filter button */}
        <div className="flex items-center justify-between gap-2 py-3 px-3 sm:pl-2 sm:pr-3 bg-[var(--bg)]/50 border-b border-[var(--brd)]">
          <div className="flex items-center gap-2">
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
                <span className="min-w-[18px] h-[18px] rounded-full bg-[var(--gold)] text-[var(--bg)] text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <div className="hidden md:flex flex-wrap items-center justify-between gap-x-4 gap-y-2 flex-1">
              <div className="flex items-center gap-1.5">
                <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] shrink-0">Status</label>
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
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] shrink-0">Start date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  title="Start date"
                  aria-label="Start date"
                  className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[36px] w-[130px]"
                />
                <span className="text-[10px] text-[var(--tx3)]">to</span>
                <label className="sr-only">End date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  title="End date"
                  aria-label="End date"
                  className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[36px] w-[130px]"
                />
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile filter bottom sheet */}
        {(filterOpen) && (
          <div className="md:hidden border-b border-[var(--brd)] bg-[var(--bg)]/80 px-3 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[var(--tx3)]">Filters</span>
              <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[12px] font-semibold">Done</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</label>
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
                <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Start date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">End date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                />
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)]">
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="dl">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
              No residential moves yet
            </div>
          ) : filtered.map((m) => (
            <div
              key={m.id}
              className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2.5 px-3 py-3 sm:py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all duration-200 group"
            >
              <Link href={`/admin/moves/${m.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0 sm:flex-nowrap">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] shrink-0 text-[var(--tx2)]">
                    <Icon name="home" className="w-[16px] h-[16px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] sm:text-[11px] font-semibold text-[var(--tx)] break-words line-clamp-2">
                      {m.client_name || "—"}
                    </div>
                    <div className="text-[9px] text-[var(--tx3)] mt-0.5 truncate max-w-[280px] sm:max-w-none" title={`${m.from_address || ""} → ${m.to_address || ""}`}>
                      {truncateAddress(m.from_address, m.to_address)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-2.5 sm:flex-nowrap">
                  <span className="text-[10px] text-[var(--tx3)] tabular-nums">{formatMoveDate(m.scheduled_date)}</span>
                  <span className={`tabular-nums font-mono text-[10px] font-bold ${priceColor(m.status)}`}>
                    ${Number(m.estimate || 0).toLocaleString()}
                  </span>
                  <Badge status={m.status ?? ""} />
                </div>
              </Link>
              <div className="flex justify-end sm:justify-start shrink-0 touch-manipulation sm:pl-0">
                <MoveNotifyButton move={m} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
