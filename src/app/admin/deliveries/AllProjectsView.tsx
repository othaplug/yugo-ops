"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../components/BackButton";
import Badge from "../components/Badge";
import MoveDateFilter, { getDateRangeFromPreset } from "../components/MoveDateFilter";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";

const PARTNER_TYPES = ["all", "retail", "designer", "hospitality", "gallery"] as const;
const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "scheduled", label: "Scheduled" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

interface Delivery {
  id: string;
  delivery_number: string;
  client_name: string;
  customer_name: string;
  items: string[];
  scheduled_date: string;
  time_slot: string;
  status: string;
  category: string;
}

interface Move {
  id: string;
  client_name: string;
  from_address?: string | null;
  to_address?: string | null;
  delivery_address?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  status: string;
  move_type: string;
  estimate?: number | null;
}

export default function AllProjectsView({
  deliveries,
  moves,
  today,
}: {
  deliveries: Delivery[];
  moves: Move[];
  today: string;
}) {
  const [mainTab, setMainTab] = useState<"partners" | "move">("partners");
  const [partnerType, setPartnerType] = useState<(typeof PARTNER_TYPES)[number]>("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [moveDatePreset, setMoveDatePreset] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);

  const dateRange = getDateRangeFromPreset(moveDatePreset);
  const dateFrom = dateRange?.from ?? "";
  const dateTo = dateRange?.to ?? "";

  const filteredDeliveries = useMemo(() => {
    let list = [...deliveries];
    if (partnerType !== "all") {
      list = list.filter((d) => (d.category || "").toLowerCase() === partnerType.toLowerCase());
    }
    if (statusFilter) {
      list = list.filter((d) => (d.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (dateFrom) list = list.filter((d) => (d.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((d) => (d.scheduled_date || "") <= dateTo);
    return list;
  }, [deliveries, partnerType, statusFilter, dateFrom, dateTo]);

  const filteredMoves = useMemo(() => {
    let list = [...moves];
    if (statusFilter) {
      list = list.filter((m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase());
    }
    if (dateFrom) list = list.filter((m) => (m.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (m.scheduled_date || "") <= dateTo);
    return list;
  }, [moves, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!(statusFilter || moveDatePreset);
  const activeFilterCount = [statusFilter, moveDatePreset].filter(Boolean).length;
  const clearFilters = () => {
    setStatusFilter("");
    setMoveDatePreset("");
  };

  const partnerTabs = [
    { key: "all" as const, label: "All" },
    { key: "retail" as const, label: "Retail" },
    { key: "designer" as const, label: "Designers" },
    { key: "hospitality" as const, label: "Hospitality" },
    { key: "gallery" as const, label: "Gallery" },
  ];

  const mainTabs = [
    { key: "partners" as const, label: "Partners", count: filteredDeliveries.length },
    { key: "move" as const, label: "Move", count: filteredMoves.length },
  ];

  return (
    <>
      {/* Header with dynamic New Project / New Move button */}
      <div className="flex items-center justify-between mb-4">
        <BackButton label="Back" />
        <Link
          href={mainTab === "move" ? "/admin/moves/new" : "/admin/deliveries/new"}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all duration-200"
        >
          {mainTab === "move" ? "+ New Move" : "+ New Project"}
        </Link>
      </div>

      {/* Two tabs only: Partners | Move */}
      <div className="flex border-b border-[var(--brd)] mb-5">
        {mainTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`px-5 py-2.5 text-[11px] font-semibold border-b-2 transition-colors -mb-px
              ${mainTab === tab.key
                ? "text-[var(--gold)] border-[var(--gold)]"
                : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] font-medium opacity-80">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Partner type pills – only when Partners tab */}
      {mainTab === "partners" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {partnerTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setPartnerType(t.key)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors
                ${partnerType === t.key ? "bg-[var(--gold)] text-[#0D0D0D]" : "bg-[var(--card)] border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/50"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Single filter bar – applies to active tab */}
      <div className="flex items-center justify-between gap-2 py-2.5 px-3 bg-[var(--bg)]/40 border border-[var(--brd)] rounded-lg mb-5">
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-md border border-[var(--brd)] bg-[var(--card)] text-[11px] font-medium text-[var(--tx)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="min-w-[18px] h-[18px] rounded-full bg-[var(--gold)] text-[#0D0D0D] text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="hidden md:flex flex-wrap items-center gap-x-5 gap-y-2 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-[var(--tx3)]">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-md px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[100px]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} label="Move date" />
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">
              Clear
            </button>
          )}
        </div>
      </div>
      {filterOpen && (
        <div className="md:hidden border border-[var(--brd)] rounded-lg bg-[var(--card)] px-3 py-4 space-y-4 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-[var(--tx3)]">Filters</span>
            <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[11px] font-medium">Done</button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 min-h-[40px]">
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[var(--tx3)] mb-1">Move date</label>
              <select value={moveDatePreset} onChange={(e) => setMoveDatePreset(e.target.value)} className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-3 py-2 min-h-[40px]">
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
              <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">Clear all</button>
            )}
          </div>
        </div>
      )}

      {/* Partners tab: only partner list */}
      {mainTab === "partners" && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--brd)] bg-[var(--bg)]/30">
            <span className="text-[11px] font-semibold text-[var(--tx2)]">Partner projects</span>
            <span className="ml-2 text-[10px] text-[var(--tx3)]">({filteredDeliveries.length})</span>
          </div>
          <div className="divide-y divide-[var(--brd)]">
            {filteredDeliveries.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
                No projects {statusFilter === "pending" ? "pending" : dateFrom === today && dateTo === today ? "today" : "yet"}
              </div>
            ) : (
              filteredDeliveries.map((d) => (
                <Link
                  key={d.id}
                  href={getDeliveryDetailPath(d)}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] hover:bg-[var(--bg)]/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{d.customer_name}</div>
                    <div className="text-[10px] text-[var(--tx3)] truncate">{d.client_name} · {d.items?.length || 0} items · {d.delivery_number}</div>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <div className="text-[11px] text-[var(--tx2)]">{formatMoveDate(d.scheduled_date)}</div>
                    <div className="text-[10px] text-[var(--tx3)]">{d.time_slot}</div>
                  </div>
                  <div className="sm:hidden text-[10px] text-[var(--tx3)] shrink-0">{formatMoveDate(d.scheduled_date)}</div>
                  <Badge status={d.status} />
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* Move tab: only moves list */}
      {mainTab === "move" && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--brd)] bg-[var(--bg)]/30">
            <span className="text-[11px] font-semibold text-[var(--tx2)]">Moves</span>
            <span className="ml-2 text-[10px] text-[var(--tx3)]">({filteredMoves.length})</span>
          </div>
          <div className="divide-y divide-[var(--brd)]">
            {filteredMoves.length === 0 ? (
              <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
                No moves {statusFilter === "pending" ? "pending" : dateFrom === today && dateTo === today ? "today" : "yet"}
              </div>
            ) : (
              filteredMoves.map((m) => (
                <Link
                  key={m.id}
                  href={getMoveDetailPath(m)}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] hover:bg-[var(--bg)]/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{m.client_name}</div>
                    <div className="text-[10px] text-[var(--tx3)] truncate">
                      {[m.from_address, m.to_address || m.delivery_address].filter(Boolean).join(" → ") || "—"}
                    </div>
                  </div>
                  <div className="hidden sm:block text-right shrink-0">
                    <div className="text-[11px] text-[var(--tx2)]">{formatMoveDate(m.scheduled_date)}</div>
                    <div className="text-[10px] font-medium text-[var(--gold)]">{formatCurrency(m.estimate ?? 0)}</div>
                  </div>
                  <div className="sm:hidden text-[10px] text-[var(--tx3)] shrink-0">{formatMoveDate(m.scheduled_date)}</div>
                  <Badge status={m.status} />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
