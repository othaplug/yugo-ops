"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import Badge from "../../components/Badge";
import { Icon } from "@/components/AppIcons";
import MoveNotifyButton from "../MoveNotifyButton";

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
  { value: "final_payment_received", label: "Final Payment Received" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ResidentialMovesClient({ moves }: { moves: Move[] }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
  const clearFilters = () => {
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-4"><BackButton label="Back" /></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
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
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 pl-2 pr-3 bg-[var(--bg)]/50 border-b border-[var(--brd)]">
          <div className="flex items-center gap-1.5">
            <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] shrink-0">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[100px]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <label className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] shrink-0">Date range</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              />
              <span className="text-[10px] text-[var(--tx3)]">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="dl">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
              No residential moves yet
            </div>
          ) : filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all duration-200 group"
            >
              <Link href={`/admin/moves/${m.id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--gdim)] shrink-0 text-[var(--tx2)]">
                  <Icon name="home" className="w-[16px] h-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{m.client_name}</div>
                  <div className="text-[9px] text-[var(--tx3)] truncate">
                    {m.from_address} → {m.to_address}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[var(--tx3)]">{m.scheduled_date}</div>
                  <div className="text-[10px] font-bold text-[var(--gold)]">
                    ${Number(m.estimate || 0).toLocaleString()}
                  </div>
                </div>
                <Badge status={m.status ?? ""} />
              </Link>
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
