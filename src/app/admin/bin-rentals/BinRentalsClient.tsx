"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/design-system/admin/layout"
import { KpiStrip } from "@/design-system/admin/dashboard"
import { Button, Select, StatusPill } from "@/design-system/admin/primitives"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type BulkAction,
  type RowAction,
} from "@/design-system/admin/table"
import { formatCompactCurrency } from "@/lib/format-currency"
import { csvField } from "@/lib/admin-csv-field"
import BackButton from "../components/BackButton"

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off Scheduled",
  bins_delivered: "Delivered",
  in_use: "In Use",
  pickup_scheduled: "Pickup Scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

const BUNDLE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1BR",
  "2br": "2BR",
  "3br": "3BR",
  "4br_plus": "4BR+",
  individual: "Custom",
}

function binStatusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  const k = (s || "").toLowerCase()
  if (["confirmed", "bins_delivered", "bins_collected", "completed"].includes(k))
    return "success"
  if (k === "overdue") return "danger"
  if (["drop_off_scheduled", "in_use", "pickup_scheduled"].includes(k))
    return "info"
  if (k === "cancelled") return "neutral"
  return "neutral"
}

function fmtBinDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  })
}

interface BinOrder {
  id: string
  order_number: string
  client_name: string
  client_email: string
  client_phone: string
  delivery_address: string
  bundle_type: string
  bin_count: number
  move_date: string
  drop_off_date: string
  pickup_date: string
  status: string
  total: number
  source: string
  created_at: string
  drop_off_completed_at: string | null
  pickup_completed_at: string | null
  bins_missing: number
  move_id: string | null
}

interface Stats {
  activeOrders: number
  dropoffsThisWeek: number
  pickupsThisWeek: number
  revenue30d: number
}

export default function BinRentalsClient({
  orders,
  stats,
}: {
  orders: BinOrder[]
  stats: Stats
}) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  })
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    new Set(),
  )

  const baseRows = React.useMemo(() => {
    if (statusFilter === "all") return orders
    return orders.filter((o) => o.status === statusFilter)
  }, [orders, statusFilter])

  const kpiTiles = React.useMemo(
    () => [
      {
        id: "active",
        label: "Active orders",
        value: String(stats.activeOrders),
        hint: "In progress",
      },
      {
        id: "dropoffs",
        label: "Drop-offs this week",
        value: String(stats.dropoffsThisWeek),
      },
      {
        id: "pickups",
        label: "Pickups this week",
        value: String(stats.pickupsThisWeek),
      },
      {
        id: "revenue",
        label: "Revenue (30d)",
        value: formatCompactCurrency(stats.revenue30d),
        hint: "Paid orders",
        valueClassName: "text-[var(--yu3-success)]",
      },
    ],
    [stats],
  )

  const matchCount = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return baseRows.length
    return baseRows.filter((o) => {
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.client_name.toLowerCase().includes(q) ||
        o.client_email.toLowerCase().includes(q) ||
        o.delivery_address.toLowerCase().includes(q)
      )
    }).length
  }, [baseRows, search])

  const columns = React.useMemo<ColumnDef<BinOrder>[]>(
    () => [
      {
        id: "order_number",
        header: "Order",
        shortLabel: "Order",
        accessor: (o) => o.order_number,
        sortable: true,
        width: 130,
        cell: (o) => (
          <span className="font-mono text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            {o.order_number}
            {o.status === "overdue" && (
              <span className="text-[var(--yu3-danger)] text-[11px] font-semibold ml-1.5 normal-case">
                Overdue
              </span>
            )}
          </span>
        ),
      },
      {
        id: "client",
        header: "Client",
        accessor: (o) =>
          [o.client_name, o.client_email, o.delivery_address].filter(Boolean).join(" "),
        sortable: true,
        width: 220,
        cell: (o) => (
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
              {o.client_name}
            </div>
            <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
              {o.client_email}
            </div>
          </div>
        ),
      },
      {
        id: "bundle",
        header: "Bundle",
        accessor: (o) =>
          `${BUNDLE_LABELS[o.bundle_type] || o.bundle_type} (${o.bin_count})`,
        sortable: true,
        width: 120,
        cell: (o) => (
          <span>
            <span className="font-medium text-[var(--yu3-ink)]">
              {BUNDLE_LABELS[o.bundle_type] || o.bundle_type}
            </span>
            <span className="text-[var(--yu3-ink-muted)] ml-1">({o.bin_count})</span>
          </span>
        ),
      },
      {
        id: "move_date",
        header: "Move date",
        accessor: (o) => o.move_date,
        sortable: true,
        width: 100,
        cell: (o) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap">
            {fmtBinDate(o.move_date)}
          </span>
        ),
      },
      {
        id: "drop_off_date",
        header: "Drop-off",
        accessor: (o) => o.drop_off_date,
        sortable: true,
        width: 100,
        cell: (o) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap">
            {fmtBinDate(o.drop_off_date)}
          </span>
        ),
      },
      {
        id: "pickup_date",
        header: "Pickup",
        accessor: (o) => o.pickup_date,
        sortable: true,
        width: 100,
        cell: (o) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap">
            {fmtBinDate(o.pickup_date)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (o) => STATUS_LABELS[o.status] || o.status,
        sortable: true,
        width: 150,
        cell: (o) => (
          <StatusPill tone={binStatusTone(o.status)}>
            {STATUS_LABELS[o.status] || o.status}
          </StatusPill>
        ),
      },
      {
        id: "total",
        header: "Total",
        accessor: (o) => Number(o.total || 0),
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (o) => (
          <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            ${Number(o.total).toFixed(0)}
          </span>
        ),
      },
      {
        id: "created_at",
        header: "Created",
        accessor: (o) => o.created_at,
        sortable: true,
        width: 120,
        hiddenByDefault: true,
        cell: (o) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {o.created_at
              ? new Date(o.created_at).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : ""}
          </span>
        ),
      },
    ],
    [],
  )

  const rowsMatchingSearch = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return baseRows
    return baseRows.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        o.client_name.toLowerCase().includes(q) ||
        o.client_email.toLowerCase().includes(q) ||
        o.delivery_address.toLowerCase().includes(q),
    )
  }, [baseRows, search])

  const onExport = React.useCallback(() => {
    const headers = [
      "Order",
      "Client",
      "Client email",
      "Bundle",
      "Move date",
      "Drop-off",
      "Pickup",
      "Status",
      "Total",
    ]
    const lines = rowsMatchingSearch.map((o) =>
      [
        o.order_number,
        o.client_name,
        o.client_email,
        `${BUNDLE_LABELS[o.bundle_type] || o.bundle_type} (${o.bin_count})`,
        fmtBinDate(o.move_date),
        fmtBinDate(o.drop_off_date),
        fmtBinDate(o.pickup_date),
        STATUS_LABELS[o.status] || o.status,
        String(Number(o.total).toFixed(0)),
      ]
        .map((c) => csvField(String(c)))
        .join(","),
    )
    const csv = [headers.map(csvField).join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "bin-orders.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [rowsMatchingSearch])

  const bulkActions = React.useMemo<BulkAction<BinOrder>[]>(
    () => [
      {
        id: "export",
        label: "Export selected CSV",
        run: (rows) => {
          if (rows.length === 0) return
          const headers = [
            "Order",
            "Client",
            "Client email",
            "Bundle",
            "Move date",
            "Drop-off",
            "Pickup",
            "Status",
            "Total",
          ]
          const lines = rows.map((o) =>
            [
              o.order_number,
              o.client_name,
              o.client_email,
              `${BUNDLE_LABELS[o.bundle_type] || o.bundle_type} (${o.bin_count})`,
              fmtBinDate(o.move_date),
              fmtBinDate(o.drop_off_date),
              fmtBinDate(o.pickup_date),
              STATUS_LABELS[o.status] || o.status,
              String(Number(o.total).toFixed(0)),
            ]
              .map((c) => csvField(String(c)))
              .join(","),
          )
          const csv = [headers.map(csvField).join(","), ...lines].join("\n")
          const blob = new Blob([csv], { type: "text/csv" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "bin-orders-selected.csv"
          a.click()
          URL.revokeObjectURL(url)
        },
      },
    ],
    [],
  )

  const rowActions = React.useMemo<RowAction<BinOrder>[]>(
    () => [
      {
        id: "open",
        label: "Open order",
        run: (o) => router.push(`/admin/bin-rentals/${o.id}`),
      },
    ],
    [router],
  )

  return (
    <div className="w-full min-w-0 flex flex-col gap-6 py-1 animate-fade-up">
      <div>
        <BackButton
          label="Back"
          variant="v2"
          className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
        />
      </div>

      <PageHeader
        eyebrow="Operations"
        title="Bin Rentals"
        description="Track bin orders, drop offs, and pickups across every active rental."
        actions={
          <Button asChild variant="primary" size="sm">
            <Link href="/admin/quotes/new?service=bin_rental">Generate quote</Link>
          </Button>
        }
      />

      <KpiStrip tiles={kpiTiles} columns={4} variant="pills" />

      <section className="min-w-0" aria-labelledby="bin-orders-heading">
        <h2
          id="bin-orders-heading"
          className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-3"
        >
          Orders
        </h2>
        <DataTable<BinOrder>
          columns={columns}
          rows={baseRows}
          rowId={(o) => o.id}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by order, client, address…"
          sort={sort}
          onSortChange={setSort}
          selectedRowIds={selectedIds}
          onSelectedRowIdsChange={setSelectedIds}
          bulkActions={bulkActions}
          rowActions={rowActions}
          onRowClick={(o) => router.push(`/admin/bin-rentals/${o.id}`)}
          onExport={onExport}
          toolbarRight={
            <div className="w-full min-w-[min(100%,12rem)] sm:w-[12rem] shrink-0">
              <label className="sr-only" htmlFor="bin-orders-status-filter">
                Status
              </label>
              <Select
                id="bin-orders-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full"
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-3 text-right">
          {matchCount} of {orders.length} orders
        </p>
      </section>
    </div>
  )
}
