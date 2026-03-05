"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import MoveDateFilter, { getDateRangeFromPreset } from "../components/MoveDateFilter";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { getMoveDetailPath, getDeliveryDetailPath } from "@/lib/move-code";
import { getStatusLabel, normalizeStatus, MOVE_STATUS_LINE_COLOR, DELIVERY_STATUS_LINE_COLOR, MOVE_STATUS_COLORS_ADMIN } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

const PARTNER_TYPES = ["all", "retail", "designer", "hospitality", "gallery"] as const;
const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "pending_approval", label: "Pending Approval" },
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

const DELIVERY_STATUS_STYLE: Record<string, string> = {
  pending: "text-[var(--gold)] bg-[var(--gdim)]",
  pending_approval: "text-amber-400 bg-amber-500/10",
  scheduled: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  confirmed: "text-[#3B82F6] bg-[rgba(59,130,246,0.1)]",
  dispatched: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  in_transit: "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  "in-transit": "text-[var(--org)] bg-[rgba(212,138,41,0.1)]",
  delivered: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  completed: "text-[var(--grn)] bg-[rgba(45,159,90,0.1)]",
  cancelled: "text-[var(--red)] bg-[rgba(209,67,67,0.1)]",
};

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
    if (partnerType !== "all") list = list.filter((d) => (d.category || "").toLowerCase() === partnerType.toLowerCase());
    if (statusFilter) list = list.filter((d) => (d.status || "").toLowerCase() === statusFilter.toLowerCase());
    if (dateFrom) list = list.filter((d) => (d.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((d) => (d.scheduled_date || "") <= dateTo);
    return list;
  }, [deliveries, partnerType, statusFilter, dateFrom, dateTo]);

  const filteredMoves = useMemo(() => {
    let list = [...moves];
    if (statusFilter) list = list.filter((m) => (m.status || "").toLowerCase() === statusFilter.toLowerCase());
    if (dateFrom) list = list.filter((m) => (m.scheduled_date || "") >= dateFrom);
    if (dateTo) list = list.filter((m) => (m.scheduled_date || "") <= dateTo);
    return list;
  }, [moves, statusFilter, dateFrom, dateTo]);

  const hasActiveFilters = !!(statusFilter || moveDatePreset);
  const activeFilterCount = [statusFilter, moveDatePreset].filter(Boolean).length;
  const clearFilters = () => { setStatusFilter(""); setMoveDatePreset(""); };

  const pendingApproval = useMemo(
    () => deliveries.filter((d) => d.status === "pending_approval" || (d.status === "pending" && (d as unknown as Record<string, unknown>).created_by_source === "partner_portal")),
    [deliveries],
  );

  const totalDeliveries = deliveries.length;
  const totalMoves = moves.length;
  const todayCount = deliveries.filter((d) => d.scheduled_date === today).length + moves.filter((m) => m.scheduled_date === today).length;
  const summaryParts = [
    `${totalDeliveries} deliveries`,
    `${totalMoves} moves`,
    todayCount > 0 ? `${todayCount} today` : null,
    pendingApproval.length > 0 ? `${pendingApproval.length} pending approval` : null,
  ].filter(Boolean);

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-heading text-[24px] sm:text-[28px] font-bold text-[var(--tx)] tracking-tight">All Projects</h1>
        <Link
          href={mainTab === "move" ? "/admin/moves/new" : "/admin/deliveries/new"}
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
        >
          + {mainTab === "move" ? "New Move" : "New Project"}
        </Link>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mb-5 font-medium">{summaryParts.join(" \u00b7 ")}</p>

      {/* Pending approval strip */}
      {pendingApproval.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[12px] font-semibold text-amber-300">
              {pendingApproval.length} partner request{pendingApproval.length > 1 ? "s" : ""} awaiting approval
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setMainTab("partners"); setStatusFilter("pending_approval"); }}
            className="text-[11px] font-bold text-amber-400 hover:underline"
          >
            View all
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5">
        {([
          { key: "partners" as const, label: "Partners", count: filteredDeliveries.length },
          { key: "move" as const, label: "Moves", count: filteredMoves.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              mainTab === tab.key
                ? "bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20"
                : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-70">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Partner type pills */}
      {mainTab === "partners" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {([
            { key: "all" as const, label: "All" },
            { key: "retail" as const, label: "Retail" },
            { key: "designer" as const, label: "Designers" },
            { key: "hospitality" as const, label: "Hospitality" },
            { key: "gallery" as const, label: "Gallery" },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setPartnerType(t.key)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
                partnerType === t.key
                  ? "bg-[var(--gold)] text-[#0D0D0D]"
                  : "text-[var(--tx3)] hover:text-[var(--tx)] hover:bg-[var(--card)]/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => setFilterOpen(!filterOpen)}
          className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-[var(--tx2)] border border-[var(--brd)] bg-[var(--card)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filters
          {activeFilterCount > 0 && <span className="min-w-[16px] h-[16px] rounded-full bg-[var(--gold)] text-[#0D0D0D] text-[9px] font-bold flex items-center justify-center">{activeFilterCount}</span>}
        </button>
        <div className="hidden md:flex items-center gap-3 flex-1">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} label="Date" />
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="text-[10px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">Clear</button>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filterOpen && (
        <div className="md:hidden border border-[var(--brd)] rounded-xl bg-[var(--card)] px-4 py-4 space-y-3 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-[var(--tx3)]">Filters</span>
            <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[11px] font-medium">Done</button>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <MoveDateFilter value={moveDatePreset} onChange={setMoveDatePreset} label="Date" />
          {hasActiveFilters && <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--gold)]">Clear all</button>}
        </div>
      )}

      {/* ── Partners list ── */}
      {mainTab === "partners" && (
        <div>
          {filteredDeliveries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-[var(--tx3)]">No deliveries {statusFilter ? `with status "${statusFilter}"` : "found"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredDeliveries.map((d) => {
                const s = (d.status || "").toLowerCase();
                const lineColor = DELIVERY_STATUS_LINE_COLOR[s] || "var(--gold)";
                const statusStyle = DELIVERY_STATUS_STYLE[s] || "text-[var(--tx3)] bg-[var(--gdim)]";
                return (
                  <Link
                    key={d.id}
                    href={getDeliveryDetailPath(d)}
                    className="group flex items-start gap-3 py-3.5 px-4 -mx-1 rounded-xl hover:bg-[var(--card)]/60 transition-all"
                  >
                    <div className="shrink-0 w-[56px] pt-0.5 text-right">
                      <div className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">{formatMoveDate(d.scheduled_date)}</div>
                      <div className="text-[10px] text-[var(--tx3)]">{d.time_slot || ""}</div>
                    </div>
                    <div className="w-[3px] rounded-full shrink-0 self-stretch min-h-[44px]" style={{ backgroundColor: lineColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold leading-tight ${statusStyle}`}>
                          {toTitleCase(d.status || "")}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--tx3)]">{d.category || "Delivery"}</span>
                      </div>
                      <div className="text-[14px] font-bold text-[var(--tx)] leading-snug group-hover:text-[var(--gold)] transition-colors">
                        {d.customer_name || d.client_name}
                      </div>
                      <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">
                        {d.client_name}{d.items?.length ? ` \u00b7 ${d.items.length} item${d.items.length > 1 ? "s" : ""}` : ""}
                      </div>
                    </div>
                    <svg className="shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Moves list ── */}
      {mainTab === "move" && (
        <div>
          {filteredMoves.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[13px] text-[var(--tx3)]">No moves {statusFilter ? `with status "${statusFilter}"` : "found"}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMoves.map((m) => {
                const s = (m.status || "").toLowerCase();
                const n = normalizeStatus(s) || "";
                const lineColor = MOVE_STATUS_LINE_COLOR[s] || MOVE_STATUS_LINE_COLOR[n] || "var(--gold)";
                const statusStyle = MOVE_STATUS_COLORS_ADMIN[s] || MOVE_STATUS_COLORS_ADMIN[n] || "text-[var(--tx3)] bg-[var(--gdim)]";
                const addr = [m.from_address, m.to_address || m.delivery_address].filter(Boolean).join(" \u2192 ");
                return (
                  <Link
                    key={m.id}
                    href={getMoveDetailPath(m)}
                    className="group flex items-start gap-3 py-3.5 px-4 -mx-1 rounded-xl hover:bg-[var(--card)]/60 transition-all"
                  >
                    <div className="shrink-0 w-[56px] pt-0.5 text-right">
                      <div className="text-[12px] font-semibold text-[var(--tx2)] tabular-nums">{formatMoveDate(m.scheduled_date)}</div>
                    </div>
                    <div className="w-[3px] rounded-full shrink-0 self-stretch min-h-[44px]" style={{ backgroundColor: lineColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold leading-tight ${statusStyle}`}>
                          {getStatusLabel(m.status)}
                        </span>
                        {m.estimate != null && Number(m.estimate) > 0 && (
                          <span className="text-[11px] font-bold text-[var(--gold)]">{formatCurrency(m.estimate)}</span>
                        )}
                      </div>
                      <div className="text-[14px] font-bold text-[var(--tx)] leading-snug group-hover:text-[var(--gold)] transition-colors">
                        {m.client_name}
                      </div>
                      {addr && <div className="text-[11px] text-[var(--tx3)] mt-0.5 truncate">{addr}</div>}
                    </div>
                    <svg className="shrink-0 w-4 h-4 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity mt-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
