"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "../components/BackButton";
import FilterBar from "../components/FilterBar";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

type Client = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  outstanding_balance?: number | null;
  created_at?: string | null;
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
  moveClientData: Map<
    string,
    {
      move_type: string;
      scheduled_date: string | null;
      status: string;
      estimate: number;
    }
  >;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("");

  const router = useRouter();

  type MoveClientRow = Client & {
    move_type: string;
    move_date: string | null;
    move_status: string;
    estimate: number;
  };

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
      id: "created_at",
      label: "Create date",
      accessor: (c) => c.created_at || "",
      sortable: true,
      render: (c) => (
        <span className="text-[11px] text-[var(--tx2)] tabular-nums whitespace-nowrap">
          {c.created_at ? formatAdminCreatedAt(c.created_at) : "—"}
        </span>
      ),
    },
    {
      id: "name",
      label: "Client",
      accessor: (c) => c.name || "",
      render: (c) => {
        const s = (c.move_status || "").toLowerCase();
        const isActive = ["confirmed", "scheduled", "in_progress"].includes(s);
        return (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[var(--tx)]">
              {c.name}
            </span>
            {isActive && (
              <span className="dt-badge text-[var(--grn)]">
                Active
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "move_type",
      label: "Type",
      accessor: (c) => c.move_type,
      render: (c) => (
        <span className="text-[11px] uppercase text-[var(--tx2)]">
          {c.move_type === "office" ? "Commercial" : "Residential"}
        </span>
      ),
    },
    {
      id: "contact",
      label: "Contact",
      accessor: (c) => c.contact_name || c.email || "",
      render: (c) => (
        <div>
          <div className="text-[10px] text-[var(--tx)]">{c.contact_name}</div>
          <div className="text-[10px] text-[var(--tx3)]">{c.email}</div>
        </div>
      ),
    },
    {
      id: "move_date",
      label: "Move Date",
      accessor: (c) => c.move_date || "",
      render: (c) => (
        <span className="text-[11px] text-[var(--tx2)]">
          {c.move_date ? formatMoveDate(c.move_date) : "-"}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      accessor: (c) => c.move_status || "",
      render: (c) => (
        <span
          className={`dt-badge ${
            c.move_status === "completed"
              ? "text-[var(--grn)]"
              : c.move_status === "cancelled"
                ? "text-[var(--red)]"
                : "text-[var(--gold)]"
          }`}
        >
          {(c.move_status || "-").replace("_", " ")}
        </span>
      ),
    },
    {
      id: "owing",
      label: "Balance",
      accessor: (c) => c.outstanding_balance ?? 0,
      render: (c) => (
        <span className="text-[11px] text-[var(--tx)]">
          {(c.outstanding_balance ?? 0) > 0
            ? formatCurrency(c.outstanding_balance)
            : "-"}
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

  const activeClients = filteredClients.filter((c) =>
    ["confirmed", "scheduled", "in_progress"].includes(c.move_status),
  ).length;
  const withBalance = filteredClients.filter(
    (c) => (c.outstanding_balance ?? 0) > 0,
  ).length;

  return (
    <div className="max-w-[1200px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="mb-6">
        <BackButton label="Back" />
      </div>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">
            CRM
          </p>
          <h1 className="admin-page-hero text-[var(--tx)]">Contacts</h1>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Link
            href="/admin/clients/new"
            className="admin-btn admin-btn-primary"
          >
            + Add Client
          </Link>
          <Link
            href="/admin/partners"
            className="admin-btn admin-btn-ghost hidden sm:inline-flex"
          >
            Partners
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard
          label="Total Clients"
          value={String(initialClients.length)}
          sub="all time"
        />
        <KpiCard
          label="Active"
          value={String(activeClients)}
          sub="move in progress"
          accent={activeClients > 0}
        />
        <KpiCard
          label="Filtered"
          value={String(filteredClients.length)}
          sub="current view"
        />
        <KpiCard
          label="With Balance"
          value={String(withBalance)}
          sub="outstanding"
          warn={withBalance > 0}
        />
      </div>

      <SectionDivider label="Client List" />

      <div className="mb-4">
        <FilterBar
          filters={[
            {
              key: "status",
              label: "Status",
              value: statusFilter,
              options: MOVE_STATUS_OPTIONS,
              onChange: setStatusFilter,
            },
            {
              key: "balance",
              label: "Balance",
              value: balanceFilter,
              options: BALANCE_OPTIONS,
              onChange: setBalanceFilter,
            },
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
        defaultSortCol="created_at"
        defaultSortDir="desc"
        searchable
        searchPlaceholder="Search clients…"
        pagination
        defaultPerPage={50}
        exportable
        exportFilename="yugo-move-clients"
        columnToggle
        selectable
        mobileCardLayout={{
          primaryColumnId: "name",
          subtitleColumnId: "contact",
          amountColumnId: "owing",
          metaColumnIds: ["move_type", "move_date", "status"],
        }}
        onRowClick={(c) => router.push(`/admin/clients/${c.id}`)}
        emptyMessage="No move clients yet"
        emptySubtext="Add a client to get started"
      />
    </div>
  );
}
