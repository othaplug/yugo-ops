"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { formatCurrency, calcHST } from "@/lib/format-currency"
import { invoicePreTaxForDisplay } from "@/lib/delivery-pricing"
import { getInvoiceStatusLabel, invoiceStatusBadgeClass } from "@/lib/invoice-admin-status"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type BulkAction,
  type ViewMode,
} from "@/design-system/admin/table"
import { formatAdminCreatedAt } from "@/lib/date-format"
import { csvField } from "@/lib/admin-csv-field"
import { useToast } from "../components/Toast"
import { getInvoiceServiceTypeLabel } from "@/utils/partnerType"
import { displayInvoiceNumber } from "@/lib/invoice-display-number"

function shortenInvoiceUrl(raw: string, maxLen = 44): string {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, "")
    const tail = `${u.pathname}${u.search}` || "/"
    const combined = `${host}${tail}`
    if (combined.length <= maxLen) return combined
    return `${combined.slice(0, maxLen - 1)}…`
  } catch {
    const noProto = trimmed.replace(/^https?:\/\//i, "")
    if (noProto.length <= maxLen) return noProto
    return `${noProto.slice(0, maxLen - 1)}…`
  }
}

type InvoiceRow = Record<string, unknown> & { id: string; client_name?: string }

export default function InvoicesTable({
  invoices,
  onRowClick,
  onRefresh,
  sortCol,
  sortDir,
  onSortChange,
}: {
  invoices: InvoiceRow[]
  onRowClick?: (invoice: InvoiceRow) => void
  onRefresh?: () => void
  sortCol?: string
  sortDir?: "asc" | "desc"
  onSortChange?: (col: string, dir: "asc" | "desc") => void
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const sort: ColumnSort | null =
    sortCol && sortDir ? { columnId: sortCol, direction: sortDir } : { columnId: "created_at", direction: "desc" }

  const handleSortChange = useCallback(
    (next: ColumnSort | null) => {
      if (!onSortChange) return
      if (next) {
        onSortChange(next.columnId, next.direction)
        return
      }
      onSortChange("created_at", "desc")
    },
    [onSortChange],
  )

  const runBulk = useCallback(
    async (action: "archive" | "cancel" | "delete" | "mark_paid", ids: string[]) => {
      const res = await fetch("/api/admin/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (data.ok) {
        const labels: Record<string, string> = {
          archive: "Archived",
          cancel: "Cancelled",
          delete: "Deleted",
          mark_paid: "Marked as paid",
        }
        toast(
          `${labels[action] || action} ${data.updated} invoice${data.updated !== 1 ? "s" : ""}`,
          "check",
        )
        setSelectedIds(new Set())
        onRefresh?.()
      } else {
        toast("Error: " + (data.error || "Failed"), "x")
      }
    },
    [toast, onRefresh],
  )

  const bulkActions = useMemo<BulkAction<InvoiceRow>[]>(
    () => [
      {
        id: "mark_paid",
        label: "Mark as paid",
        run: (rows) => runBulk("mark_paid", rows.map((r) => r.id)),
      },
      {
        id: "archive",
        label: "Archive",
        run: (rows) => runBulk("archive", rows.map((r) => r.id)),
      },
      {
        id: "cancel",
        label: "Cancel",
        run: (rows) => runBulk("cancel", rows.map((r) => r.id)),
      },
      {
        id: "delete",
        label: "Delete",
        danger: true,
        run: (rows) => runBulk("delete", rows.map((r) => r.id)),
      },
    ],
    [runBulk],
  )

  const columns = useMemo<ColumnDef<InvoiceRow>[]>(
    () => [
      {
        id: "invoice_number",
        shortLabel: "Invoice",
        header: "Invoice",
        accessor: (r) => displayInvoiceNumber(r as Parameters<typeof displayInvoiceNumber>[0]),
        width: 200,
        cell: (r) => {
          const typeLabel = getInvoiceServiceTypeLabel(r as never)
          const isMove = typeLabel === "Move"
          const num = displayInvoiceNumber(r as Parameters<typeof displayInvoiceNumber>[0])
          return (
            <div>
              <span className="font-mono text-[12px] font-semibold text-[var(--yu3-ink)]">{num}</span>
              <span
                className={`ml-2 inline-flex items-center text-[9px] font-bold uppercase tracking-[0.08em] ${
                  isMove ? "text-[var(--yu3-info)]" : "text-[var(--yu3-ink-muted)]"
                }`}
              >
                {typeLabel}
              </span>
            </div>
          )
        },
      },
      {
        id: "client_name",
        shortLabel: "Client",
        header: "Client",
        accessor: (r) => String(r.client_name ?? ""),
        width: 180,
        cell: (r) => (
          <Link
            href="/admin/clients"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--yu3-ink)] hover:text-[var(--yu3-wine)] transition-colors"
          >
            {String(r.client_name ?? "")}
          </Link>
        ),
      },
      {
        id: "amount",
        shortLabel: "Amount",
        header: "Amount",
        accessor: (r) => invoicePreTaxForDisplay(r as never),
        sortable: true,
        align: "right",
        numeric: true,
        width: 150,
        cell: (r) => {
          const pre = invoicePreTaxForDisplay(r as never)
          if (pre <= 0) return null
          return (
            <>
              <span className="font-semibold tabular-nums text-[var(--yu3-ink)]">{formatCurrency(pre)}</span>
              <span className="text-[9px] text-[var(--yu3-ink-faint)] ml-1 block sm:inline tabular-nums">
                +{formatCurrency(calcHST(pre))} HST
              </span>
            </>
          )
        },
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Create date",
        accessor: (r) => String((r as { created_at?: string }).created_at || ""),
        sortable: true,
        width: 160,
        cell: (r) => {
          const c = (r as { created_at?: string }).created_at
          return (
            <span className="text-[11px] text-[var(--yu3-ink-muted)] tabular-nums whitespace-nowrap">
              {c ? formatAdminCreatedAt(c) : ""}
            </span>
          )
        },
      },
      {
        id: "due_date",
        shortLabel: "Due",
        header: "Due date",
        accessor: (r) => String((r as { due_date?: string }).due_date || ""),
        sortable: true,
        width: 120,
        cell: (r) => {
          const d = (r as { due_date?: string | null }).due_date
          if (!d) return "—"
          return (
            <span className="text-[12px] text-[var(--yu3-ink)]">
              {typeof d === "string" && d.match(/^\d{4}-\d{2}-\d{2}/)
                ? new Date(d + (d.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : String(d)}
            </span>
          )
        },
      },
      {
        id: "status",
        shortLabel: "Status",
        header: "Status",
        accessor: (r) => getInvoiceStatusLabel((r as { status?: string }).status),
        sortable: true,
        width: 120,
        cell: (r) => (
          <span
            className={`inline-flex items-center text-[9px] font-bold tracking-[0.08em] uppercase ${invoiceStatusBadgeClass((r as { status?: string }).status)}`}
          >
            {getInvoiceStatusLabel((r as { status?: string }).status)}
          </span>
        ),
      },
      {
        id: "square",
        shortLabel: "Square",
        header: "Square",
        accessor: (r) => {
          const x = r as { square_invoice_url?: string; square_invoice_id?: string }
          return [x.square_invoice_url, x.square_invoice_id].filter(Boolean).join(" ") || ""
        },
        width: 200,
        cell: (r) => {
          const u = (r as { square_invoice_url?: string }).square_invoice_url
          if (!u) return null
          return (
            <a
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              title={u}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5 text-left max-w-[min(200px,28vw)]"
            >
              <span className="text-[10px] font-semibold text-[var(--yu3-ink)] hover:underline shrink-0">View</span>
              <span
                className="text-[9px] font-mono text-[var(--yu3-ink-faint)] truncate w-full sm:max-w-[160px]"
                title={u}
              >
                {shortenInvoiceUrl(String(u))}
              </span>
            </a>
          )
        },
      },
    ],
    [],
  )

  const onExport = useCallback(() => {
    const headers = [
      "Invoice",
      "Type",
      "Client",
      "Amount (pre-tax)",
      "Create date",
      "Due date",
      "Status",
    ]
    const rows = (invoices || []).map((r) => {
      const pre = invoicePreTaxForDisplay(r as never)
      const c = (r as { created_at?: string }).created_at
      const d = (r as { due_date?: string | null }).due_date
      return [
        displayInvoiceNumber(r as Parameters<typeof displayInvoiceNumber>[0]),
        getInvoiceServiceTypeLabel(r as never),
        String((r as { client_name?: string }).client_name ?? ""),
        pre > 0 ? formatCurrency(pre) : "",
        c ? formatAdminCreatedAt(c) : "",
        d != null && d !== "" ? String(d) : "",
        getInvoiceStatusLabel((r as { status?: string }).status),
      ]
        .map((x) => csvField(String(x)))
        .join(",")
    })
    const csv = [headers.map(csvField).join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "yugo-invoices.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [invoices])

  return (
    <DataTable<InvoiceRow>
      columns={columns}
      rows={invoices || []}
      rowId={(r) => r.id}
      search={search}
      onSearchChange={setSearch}
      sort={sort}
      onSortChange={handleSortChange}
      selectedRowIds={selectedIds}
      onSelectedRowIdsChange={setSelectedIds}
      bulkActions={bulkActions}
      onRowClick={onRowClick}
      onExport={onExport}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      availableViews={["list"]}
      searchPlaceholder="Search invoices…"
    />
  )
}
