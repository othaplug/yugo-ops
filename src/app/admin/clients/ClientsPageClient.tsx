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

  const partners = useMemo(() => initialClients.filter((c) => c.type !== "b2c"), [initialClients]);
  const moveClients = useMemo(() => initialClients.filter((c) => c.type === "b2c"), [initialClients]);

  const router = useRouter();

  const filteredPartners = useMemo(() => {
    let list = [...partners];
    if (typeFilter) list = list.filter((c) => c.type === typeFilter);
    if (balanceFilter) {
      const hasBal = (c: Client) => (c.outstanding_balance ?? 0) > 0;
      if (balanceFilter === "has") list = list.filter(hasBal);
      if (balanceFilter === "none") list = list.filter((c) => !hasBal(c));
    }
    return list;
  }, [partners, typeFilter, balanceFilter]);

  type MoveClientRow = Client & { move_type: string; move_date: string | null; move_status: string; estimate: number };

  const filteredMoveClients = useMemo((): MoveClientRow[] => {
    let list: MoveClientRow[] = moveClients.map((c) => {
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
  }, [moveClients, moveClientData, statusFilter, balanceFilter]);

  const partnerColumns: ColumnDef<Client>[] = [
    {
      id: "name", label: "Client",
      accessor: (c) => c.name || "",
      render: (c) => {
        const hasBalance = (c.outstanding_balance ?? 0) > 0;
        const isActive = Number(c.deliveries_per_month ?? 0) > 0;
        return (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--tx)]">{c.name}</span>
            {hasBalance && <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-[var(--ordim)] text-[var(--org)]">Owing</span>}
            {!hasBalance && isActive && <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold bg-[var(--grdim)] text-[var(--grn)]">Active</span>}
          </div>
        );
      },
    },
    {
      id: "type", label: "Type",
      accessor: (c) => c.type,
      render: (c) => <span className="text-[11px] capitalize text-[var(--tx2)]">{c.type}</span>,
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
      id: "avg", label: "Avg/Month",
      accessor: (c) => Number(c.deliveries_per_month) || 0,
      render: (c) => <span className="text-[11px] text-[var(--tx2)]">{c.deliveries_per_month ?? "—"}</span>,
      align: "right",
    },
    {
      id: "owing", label: "Owing",
      accessor: (c) => c.outstanding_balance ?? 0,
      render: (c) => (
        <span className="text-[11px] text-[var(--tx)]">
          {(c.outstanding_balance ?? 0) > 0 ? formatCurrency(c.outstanding_balance) : "—"}
        </span>
      ),
      align: "right",
    },
  ];

  const moveClientColumns: ColumnDef<MoveClientRow>[] = [
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

  const hasActiveFilters = !!(typeFilter || statusFilter || balanceFilter);
  const clearFilters = () => {
    setTypeFilter("");
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

      {/* Filter bar */}
      <div className="mb-4">
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

      {/* Data tables */}
      {activeTab === "partners" ? (
        <DataTable
          data={filteredPartners}
          columns={partnerColumns}
          keyField="id"
          tableId="clients-partners"
          searchable
          searchPlaceholder="Search partners…"
          pagination
          defaultPerPage={50}
          exportable
          exportFilename="yugo-partners"
          columnToggle
          onRowClick={(c) => router.push(`/admin/clients/${c.id}`)}
          emptyMessage="No partners yet"
          emptySubtext="Add a client to get started"
        />
      ) : (
        <DataTable
          data={filteredMoveClients}
          columns={moveClientColumns}
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
      )}
    </div>
  );
}
