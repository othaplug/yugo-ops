"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BackButton from "../components/BackButton";
import FilterBar, { SortableHeader } from "../components/FilterBar";
import ClientsTableBody from "./ClientsTableBody";
import MoveClientsTableBody from "./MoveClientsTableBody";

type Client = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  deliveries_per_month?: string | number | null;
  outstanding_balance?: number | null;
};

type TabId = "partners" | "move-clients";

const PARTNER_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "retail", label: "Retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "designer", label: "Designer" },
  { value: "gallery", label: "Gallery" },
  { value: "realtor", label: "Realtor" },
];

const MOVE_STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const BALANCE_OPTIONS = [
  { value: "", label: "All" },
  { value: "has", label: "Has balance" },
  { value: "none", label: "No balance" },
];

export default function ClientsPageClient({
  clients: initialClients,
  moveClientData,
}: {
  clients: Client[];
  moveClientData: Map<string, { move_type: string; scheduled_date: string | null; status: string; estimate: number }>;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("partners");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const partners = useMemo(() => initialClients.filter((c) => c.type !== "b2c"), [initialClients]);
  const moveClients = useMemo(() => initialClients.filter((c) => c.type === "b2c"), [initialClients]);

  const filteredPartners = useMemo(() => {
    let list = [...partners];
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (balanceFilter) {
      const hasBal = (c: Client) => (c.outstanding_balance ?? 0) > 0;
      if (balanceFilter === "has") list = list.filter(hasBal);
      if (balanceFilter === "none") list = list.filter((c) => !hasBal(c));
    }
    if (sortKey) {
      list.sort((a, b) => {
        let va: string | number = "";
        let vb: string | number = "";
        if (sortKey === "name") { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
        else if (sortKey === "type") { va = a.type.toLowerCase(); vb = b.type.toLowerCase(); }
        else if (sortKey === "contact") { va = (a.contact_name || a.email || "").toLowerCase(); vb = (b.contact_name || b.email || "").toLowerCase(); }
        else if (sortKey === "avg") { va = Number(a.deliveries_per_month) || 0; vb = Number(b.deliveries_per_month) || 0; }
        else if (sortKey === "owing") { va = Number(a.outstanding_balance) || 0; vb = Number(b.outstanding_balance) || 0; }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [partners, typeFilter, balanceFilter, sortKey, sortDir]);

  const filteredMoveClients = useMemo(() => {
    let list = moveClients.map((c) => {
      const moveData = moveClientData.get(c.id);
      return {
        ...c,
        move_type: moveData?.move_type ?? "residential",
        move_date: moveData?.scheduled_date ?? null,
        move_status: moveData?.status ?? "",
        estimate: moveData?.estimate ?? 0,
      };
    });
    if (statusFilter) list = list.filter((c) => (c as { move_status: string }).move_status === statusFilter);
    if (balanceFilter) {
      const hasBal = (c: Client) => (c.outstanding_balance ?? 0) > 0;
      if (balanceFilter === "has") list = list.filter(hasBal);
      if (balanceFilter === "none") list = list.filter((c) => !hasBal(c));
    }
    if (sortKey) {
      list.sort((a, b) => {
        const ax = a as Client & { move_type?: string; move_date?: string | null; move_status?: string };
        const bx = b as Client & { move_type?: string; move_date?: string | null; move_status?: string };
        let va: string | number = "";
        let vb: string | number = "";
        if (sortKey === "name") { va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); }
        else if (sortKey === "move_type") { va = (ax.move_type || "").toLowerCase(); vb = (bx.move_type || "").toLowerCase(); }
        else if (sortKey === "contact") { va = (a.contact_name || a.email || "").toLowerCase(); vb = (b.contact_name || b.email || "").toLowerCase(); }
        else if (sortKey === "move_date") { va = ax.move_date || ""; vb = bx.move_date || ""; }
        else if (sortKey === "status") { va = (ax.move_status || "").toLowerCase(); vb = (bx.move_status || "").toLowerCase(); }
        else if (sortKey === "owing") { va = Number(a.outstanding_balance) || 0; vb = Number(b.outstanding_balance) || 0; }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [moveClients, moveClientData, statusFilter, balanceFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const hasActiveFilters = !!(typeFilter || statusFilter || balanceFilter);
  const activeFilterCount = [typeFilter, statusFilter, balanceFilter].filter(Boolean).length;
  const clearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setBalanceFilter("");
  };

  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
        <BackButton label="Back" />
        <div className="flex gap-1.5 shrink-0">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all"
          >
            + Add Client
          </Link>
          <Link
            href="/admin/revenue"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            Export
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg2)] border border-[var(--brd)] rounded-xl mb-4 w-fit">
        <button
          onClick={() => setActiveTab("partners")}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
            activeTab === "partners" ? "bg-[var(--card)] text-[var(--gold)] border border-[var(--brd)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"
          }`}
        >
          Partners
        </button>
        <button
          onClick={() => setActiveTab("move-clients")}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
            activeTab === "move-clients" ? "bg-[var(--card)] text-[var(--gold)] border border-[var(--brd)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"
          }`}
        >
          Move Clients
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {/* Desktop: full filter row. Mobile: Filter button that opens accordion */}
        <div className="flex items-center justify-between gap-2 py-3 px-3 sm:pl-4 sm:pr-4 bg-[var(--bg)]/50 border-b border-[var(--brd)]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[11px] font-semibold text-[var(--tx)] touch-manipulation shrink-0"
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
            <div className="hidden md:block flex-1 min-w-0">
              <FilterBar
                filters={
                  activeTab === "partners"
                    ? [
                        { key: "type", label: "Type", value: typeFilter, options: PARTNER_TYPE_OPTIONS, onChange: setTypeFilter },
                        { key: "balance", label: "Balance", value: balanceFilter, options: BALANCE_OPTIONS, onChange: setBalanceFilter },
                      ]
                    : [
                        { key: "status", label: "Status", value: statusFilter, options: MOVE_STATUS_OPTIONS, onChange: setStatusFilter },
                        { key: "balance", label: "Balance", value: balanceFilter, options: BALANCE_OPTIONS, onChange: setBalanceFilter },
                      ]
                }
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
              />
            </div>
          </div>
        </div>

        {/* Mobile filter accordion */}
        {filterOpen && (
          <div className="md:hidden border-b border-[var(--brd)] bg-[var(--bg)]/80 px-3 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[var(--tx3)]">Filters</span>
              <button type="button" onClick={() => setFilterOpen(false)} className="text-[var(--gold)] text-[12px] font-semibold">Done</button>
            </div>
            <div className="flex flex-col gap-3">
              {activeTab === "partners" && (
                <>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Type</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                    >
                      {PARTNER_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Balance</label>
                    <select
                      value={balanceFilter}
                      onChange={(e) => setBalanceFilter(e.target.value)}
                      className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                    >
                      {BALANCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {activeTab === "move-clients" && (
                <>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                    >
                      {MOVE_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Balance</label>
                    <select
                      value={balanceFilter}
                      onChange={(e) => setBalanceFilter(e.target.value)}
                      className="w-full text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-h-[40px] touch-manipulation"
                    >
                      {BALANCE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {hasActiveFilters && (
                <button type="button" onClick={() => { clearFilters(); setFilterOpen(false); }} className="text-[10px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)]">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto -mx-px">
        <table className="w-full border-collapse min-w-[400px]">
          <thead>
            <tr>
              {activeTab === "partners" ? (
                <>
                  <SortableHeader label="Client" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-4 sm:pl-3" />
                  <SortableHeader label="Type" sortKey="type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Contact" sortKey="contact" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <SortableHeader label="AVG DEL" sortKey="avg" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortableHeader label="Owing" sortKey="owing" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                </>
              ) : (
                <>
                  <SortableHeader label="Client" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-4 sm:pl-3" />
                  <SortableHeader label="Move Type" sortKey="move_type" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Contact" sortKey="contact" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                  <SortableHeader label="Move Date" sortKey="move_date" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                  <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Balance" sortKey="owing" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                </>
              )}
              <th className="w-10 px-3 py-2 border-b border-[var(--brd)]" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {activeTab === "partners" ? (
              <ClientsTableBody clients={filteredPartners} />
            ) : (
              <MoveClientsTableBody clients={filteredMoveClients} />
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
