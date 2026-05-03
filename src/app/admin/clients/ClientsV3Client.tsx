"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
import { toTitleCase } from "@/lib/format-text";
import { getStatusLabel } from "@/lib/move-status";

import { PageHeader } from "@/design-system/admin/layout";
import { StatusPill, Avatar } from "@/design-system/admin/primitives";
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type RowAction,
  type ViewMode,
} from "@/design-system/admin/table";
import { KpiStrip } from "@/design-system/admin/dashboard";

type Client = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  outstanding_balance?: number | null;
  created_at?: string | null;
};

type Row = Client & {
  move_type: string;
  move_date: string | null;
  move_status: string;
  estimate: number;
};

export default function ClientsV3Client({
  clients,
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
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  });
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const rows = React.useMemo<Row[]>(() => {
    return clients.map((c) => {
      const m = moveClientData.get(c.id);
      return {
        ...c,
        move_type: m?.move_type ?? "residential",
        move_date: m?.scheduled_date ?? null,
        move_status: m?.status ?? "",
        estimate: m?.estimate ?? 0,
      };
    });
  }, [clients, moveClientData]);

  const kpis = React.useMemo(() => {
    const totalLTV = rows.reduce((a, r) => a + (r.estimate || 0), 0);
    const withBalance = rows.filter((r) => (r.outstanding_balance ?? 0) > 0);
    return [
      {
        id: "clients",
        label: "Total clients",
        value: rows.length.toString(),
      },
      {
        id: "outstanding",
        label: "With balance",
        value: withBalance.length.toString(),
        hint: formatCurrency(
          withBalance.reduce(
            (a, r) => a + Number(r.outstanding_balance || 0),
            0,
          ),
        ),
      },
      {
        id: "ltv",
        label: "Lifetime estimate",
        value: formatCurrency(totalLTV),
      },
    ];
  }, [rows]);

  const columns = React.useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "name",
        shortLabel: "Client",
        header: "Client",
        accessor: (r) => r.name ?? "",
        sortable: true,
        searchable: true,
        width: 280,
        cell: (r) => (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={r.name} size={28} />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
                {r.name}
              </div>
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {r.contact_name || r.email || ""}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "move_type",
        shortLabel: "Type",
        header: "Type",
        accessor: (r) => r.move_type,
        sortable: true,
        width: 130,
        cell: (r) => (
          <span className="text-[12px] text-[var(--yu3-ink)]">
            {toTitleCase(r.move_type)}
          </span>
        ),
      },
      {
        id: "move_status",
        shortLabel: "Status",
        header: "Status",
        accessor: (r) => r.move_status,
        sortable: true,
        width: 150,
        cell: (r) =>
          r.move_status ? (
            <StatusPill tone={statusTone(r.move_status)}>
              {getStatusLabel(r.move_status) || toTitleCase(r.move_status)}
            </StatusPill>
          ) : null,
      },
      {
        id: "move_date",
        shortLabel: "Last move",
        header: "Last move",
        accessor: (r) => r.move_date ?? "",
        sortable: true,
        width: 130,
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap">
            {r.move_date ? formatMoveDate(r.move_date) : ""}
          </span>
        ),
      },
      {
        id: "outstanding_balance",
        shortLabel: "Balance",
        header: "Balance",
        accessor: (r) => Number(r.outstanding_balance || 0),
        align: "right",
        sortable: true,
        numeric: true,
        width: 130,
        cell: (r) => {
          const b = Number(r.outstanding_balance || 0);
          if (b <= 0)
            return <span className="text-[var(--yu3-ink-faint)]">—</span>;
          return (
            <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-danger)]">
              {formatCurrency(b)}
            </span>
          );
        },
      },
      {
        id: "estimate",
        shortLabel: "Estimate",
        header: "Estimate",
        accessor: (r) => Number(r.estimate || 0),
        align: "right",
        sortable: true,
        numeric: true,
        width: 120,
        cell: (r) => (
          <span className="yu3-num text-[13px] text-[var(--yu3-ink)]">
            {r.estimate ? formatCurrency(r.estimate) : ""}
          </span>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Since",
        header: "Since",
        accessor: (r) => r.created_at ?? "",
        sortable: true,
        width: 120,
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {r.created_at ? formatAdminCreatedAt(r.created_at) : ""}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = React.useMemo<RowAction<Row>[]>(
    () => [
      {
        id: "open",
        label: "Open client",
        run: (r) => router.push(`/admin/clients/${r.id}`),
      },
      {
        id: "revenue",
        label: "Revenue breakdown",
        run: (r) => router.push(`/admin/clients/${r.id}/revenue`),
      },
    ],
    [router],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="CRM"
        title="Clients"
        description="Residential clients with move history and open balances."
      />
      <KpiStrip tiles={kpis} columns={3} />
      <DataTable<Row>
        columns={columns}
        rows={rows}
        rowId={(r) => r.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        rowActions={rowActions}
        onRowClick={(r) => router.push(`/admin/clients/${r.id}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
      />
    </div>
  );
}

function statusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  const k = s.toLowerCase();
  if (
    [
      "completed",
      "delivered",
      "paid",
      "accepted",
      "active",
      "confirmed",
    ].includes(k)
  )
    return "success";
  if (["cancelled", "canceled", "refunded", "expired", "failed"].includes(k))
    return "danger";
  if (
    [
      "in_progress",
      "scheduled",
      "en_route",
      "loading",
      "unloading",
      "in_transit",
    ].includes(k)
  )
    return "info";
  if (["pending", "draft", "cold", "new", "lost"].includes(k)) return "neutral";
  return "neutral";
}
