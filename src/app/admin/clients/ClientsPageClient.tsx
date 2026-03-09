"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "../components/BackButton";
import FilterBar from "../components/FilterBar";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";

type Client = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  outstanding_balance?: number | null;
};

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
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");

  const router = useRouter();

  type MoveClientRow = Client & { move_type: string; move_date: string | null; move_status: string; estimate: number };

  const filteredClients = useMemo((): MoveClientRow[] => {
    let list: MoveClientRow[] = initialClients.map((c) => {
      const moveData = moveClientData.get(c.id);
      return {
        ...c,
        move_type: moveData?.move_type ?? "residential",
        move_date: moveData?.scheduled_date ?? null,
        move_status: moveData?.status ?? "",
        estimate: moveData?.estimate ?? 0,
      };
    });
    if (statusFilter) list = list.filter((c) => c.move_status === statusFilter);
    if (balanceFilter) {
      const hasBal = (c: Client) => (c.outstanding_balance ?? 0) > 0;
      if (balanceFilter === "has") list = list.filter(hasBal);
      if (balanceFilter === "none") list = list.filter((c) => !hasBal(c));
    }
    return list;
  }, [initialClients, moveClientData, statusFilter, balanceFilter]);

  const columns: ColumnDef<MoveClientRow>[] = [
    {
      id: "name", label: "Client",
      accessor: (c) => c.name || "",
      render: (c) => {
        const s = (c.move_status || "").toLowerCase();
        const isActive = ["confirmed", "scheduled", "in_progress"].includes(s);
        return (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--tx)]">{c.name}</span>
            {isActive && <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-[var(--grdim)] text-[var(--grn)]">Active</span>}
          </div>
        );
      },
    },
    {
      id: "move_type", label: "Type",
      accessor: (c) => c.move_type,
      render: (c) => <span className="text-[11px] capitalize text-[var(--tx2)]">{c.move_type === "office" ? "Commercial" : "Residential"}</span>,
    },
    {
      id: "contact", label: "Contact",
      accessor: (c) => c.contact_name || c.email || "",
      render: (c) => (
        <div>
          <div className="text-[10px] text-[var(--tx)]">{c.contact_name}</div>
          <div className="text-[10px] text-[var(--tx3)]">{c.email}</div>
        </div>
      ),
    },
    {
      id: "move_date", label: "Move Date",
      accessor: (c) => c.move_date || "",
      render: (c) => <span className="text-[11px] text-[var(--tx2)]">{c.move_date ? formatMoveDate(c.move_date) : "—"}</span>,
    },
    {
      id: "status", label: "Status",
      accessor: (c) => c.move_status || "",
      render: (c) => (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold ${
          c.move_status === "completed" ? "bg-[var(--grdim)] text-[var(--grn)]" :
          c.move_status === "cancelled" ? "bg-[var(--rdim)] text-[var(--red)]" :
          "bg-[var(--gdim)] text-[var(--gold)]"
        }`}>
          {(c.move_status || "—").replace("_", " ")}
        </span>
      ),
    },
    {
      id: "owing", label: "Balance",
      accessor: (c) => c.outstanding_balance ?? 0,
      render: (c) => (
        <span className="text-[11px] text-[var(--tx)]">
          {(c.outstanding_balance ?? 0) > 0 ? formatCurrency(c.outstanding_balance) : "—"}
        </span>
      ),
      align: "right",
    },
  ];

  const hasActiveFilters = !!(statusFilter || balanceFilter);
  const clearFilters = () => {
    setStatusFilter("");
    setBalanceFilter("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
        <BackButton label="Back" />
        <div className="flex gap-1.5 shrink-0">
          <Link
            href="/admin/clients/new"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all"
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

      {/* Section context banner */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            B2C Move Clients
          </div>
          <p className="text-[11px] text-[var(--tx3)] hidden sm:block">
            Residential &amp; commercial move clients
          </p>
        </div>
        <Link
          href="/admin/partners"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all whitespace-nowrap"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          B2B Partners
        </Link>
      </div>

      <div className="mb-4">
        <FilterBar
          filters={[
            { key: "status", label: "Status", value: statusFilter, options: MOVE_STATUS_OPTIONS, onChange: setStatusFilter },
            { key: "balance", label: "Balance", value: balanceFilter, options: BALANCE_OPTIONS, onChange: setBalanceFilter },
          ]}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />
      </div>

      <DataTable
        data={filteredClients}
        columns={columns}
        keyField="id"
        tableId="clients-move"
        searchable
        searchPlaceholder="Search clients…"
        pagination
        defaultPerPage={50}
        exportable
        exportFilename="yugo-move-clients"
        columnToggle
        onRowClick={(c) => router.push(`/admin/clients/${c.id}`)}
        emptyMessage="No move clients yet"
        emptySubtext="Add a client to get started"
      />
    </div>
  );
}
