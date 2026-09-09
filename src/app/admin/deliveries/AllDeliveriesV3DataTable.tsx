"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash } from "@phosphor-icons/react"
import { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format"
import { getDeliveryDetailPath, formatJobId } from "@/lib/move-code"
import { toTitleCase } from "@/lib/format-text"
import { formatDeliveryPriceForAdminList } from "@/lib/delivery-pricing"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type BulkAction,
  type ViewMode,
} from "@/design-system/admin/table"
import { StatusPill } from "@/design-system/admin/primitives"
import { useToast } from "../components/Toast"
import { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility"
import {
  deliveryBulkInvoiceIneligibleReason,
  INVOICE_INELIGIBLE_LABEL,
} from "@/lib/delivery-invoice-eligibility"
import {
  deliveryTrackingBulkIneligibleReason,
  TRACKING_INELIGIBLE_LABEL,
  deliveryPaymentBulkIneligibleReason,
  PAYMENT_INELIGIBLE_LABEL,
  isDeliveredAndUnpaid,
} from "@/lib/delivery-bulk-eligibility"

export type DeliveryV3 = {
  id: string
  delivery_number: string
  client_name: string
  customer_name: string
  items: string[]
  scheduled_date: string
  time_slot: string
  status: string
  category: string
  booking_type?: string | null
  organization_id?: string | null
  vertical_code?: string | null
  contact_email?: string | null
  business_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  recipient_tracking_sent_at?: string | null
  has_invoice?: boolean | null
  invoice_status?: string | null
  payment_received_at?: string | null
  vehicle_type?: string | null
  num_stops?: number | null
  is_multi_stop?: boolean | null
  total_stops?: number | null
  project_name?: string | null
  total_price?: number | null
  admin_adjusted_price?: number | null
  quoted_price?: number | null
  final_price?: number | null
  calculated_price?: number | null
  override_price?: number | null
  delivery_type?: string | null
  zone?: number | null
  completed_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

function deliveryStatusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  const k = s.toLowerCase()
  if (["delivered", "completed", "paid"].includes(k)) return "success"
  if (["cancelled", "canceled"].includes(k)) return "danger"
  if (k === "pending_approval") return "warning"
  if (["in_transit", "dispatched", "in-transit"].includes(k)) return "info"
  return "neutral"
}

function csvField(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

function exportDeliveriesCsv(rows: DeliveryV3[], filename: string) {
  const headers = [
    "Service date",
    "Create date",
    "Partner",
    "Category",
    "Delivery ID",
    "Price",
    "Status",
  ]
  const lines = rows.map((d) => {
    const idStr = d.delivery_number
      ? formatJobId(d.delivery_number, "delivery")
      : ""
    const created = d.created_at ? formatAdminCreatedAt(d.created_at) : ""
    const row = [
      `${formatMoveDate(d.scheduled_date)} ${d.time_slot || ""}`.trim(),
      created,
      d.client_name || "",
      toTitleCase((d.category || "delivery").replace(/_/g, " ")),
      idStr,
      formatDeliveryPriceForAdminList(d),
      toTitleCase((d.status || "").replace(/_/g, " ").replace(/-/g, " ")),
    ]
    return row.map(csvField).join(",")
  })
  const csv = [headers.map(csvField).join(","), ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function AllDeliveriesV3DataTable({
  rows,
  emptyMessage,
}: {
  rows: DeliveryV3[]
  emptyMessage: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "created_at",
    direction: "desc",
  })
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = React.useState<ViewMode>("list")

  const runBulk = React.useCallback(
    async (action: "deliver" | "cancel", ids: string[]) => {
      const res = await fetch("/api/admin/deliveries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json()
      if (data.ok) {
        const labels: Record<string, string> = { deliver: "Marked delivered", cancel: "Cancelled" }
        toast(
          `${labels[action]} ${data.updated} delivery${data.updated !== 1 ? "ies" : ""}`,
          "check",
        )
        setSelectedIds(new Set())
        router.refresh()
      } else {
        toast("Error: " + (data.error || "Failed"), "x")
      }
    },
    [toast, router],
  )

  const runBulkDelete = React.useCallback(
    async (ids: string[]) => {
      const n = ids.length
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          `Delete ${n} delivery${n !== 1 ? "ies" : "y"}? This cannot be undone.`,
        )
      ) {
        return
      }
      const res = await fetch("/api/admin/deliveries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      })
      const data = await res.json()
      if (data.ok) {
        const deleted = Number(data.deleted) || 0
        const skipped = Number(data.skipped) || 0
        let msg = `Deleted ${deleted} delivery${deleted !== 1 ? "ies" : "y"}`
        if (skipped > 0) {
          msg += ` (${skipped} skipped: completed or not found)`
        }
        toast(msg, "check")
        setSelectedIds(new Set())
        router.refresh()
      } else {
        toast("Error: " + (data.error || "Failed"), "x")
      }
    },
    [toast, router],
  )

  // One generic pipeline for every eligibility-gated bulk action: split the
  // selection by its shared gate, itemize what will be skipped, confirm the
  // outward-facing ones deliberately, then POST and summarize per-id results.
  const runBulkGated = React.useCallback(
    async <R extends string>(
      rows: DeliveryV3[],
      opts: {
        action: "send_invoice" | "send_tracking" | "record_payment"
        ineligibleReason: (d: DeliveryV3) => R | null
        label: Record<R, string>
        confirmTitle: (n: number) => string
        confirmNote: string
        emptyNoun: string
        successVerb: string
        successNoun: (n: number) => string
        errorNoun: string
      },
    ) => {
      const eligible: DeliveryV3[] = []
      const skippedByReason = new Map<R, number>()
      for (const d of rows) {
        const reason = opts.ineligibleReason(d)
        if (reason) skippedByReason.set(reason, (skippedByReason.get(reason) || 0) + 1)
        else eligible.push(d)
      }

      if (eligible.length === 0) {
        const parts = [...skippedByReason.entries()].map(([r, n]) => `${n} ${opts.label[r]}`)
        toast(`No ${opts.emptyNoun} to process. ${parts.join(", ")}`.trim(), "x")
        return
      }

      if (typeof window !== "undefined") {
        const lines = [opts.confirmTitle(eligible.length), "", opts.confirmNote]
        if (skippedByReason.size > 0) {
          lines.push("", "Skipped:")
          for (const [r, n] of skippedByReason.entries()) lines.push(`  - ${n} ${opts.label[r]}`)
        }
        if (!window.confirm(lines.join("\n"))) return
      }

      const res = await fetch("/api/admin/deliveries/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: opts.action, ids: eligible.map((d) => d.id) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        toast("Error: " + (data.error || `Failed to ${opts.errorNoun}`), "x")
        return
      }

      const created = Number(data.created) || 0
      const skipped = Number(data.skipped) || 0
      const failed = Number(data.failed) || 0
      let msg = `${opts.successVerb} ${created} ${opts.successNoun(created)}`
      if (skipped > 0) msg += `, ${skipped} skipped`
      if (failed > 0) {
        const firstErr = Array.isArray(data.results)
          ? data.results.find((r: { status?: string; reason?: string }) => r.status === "error")
              ?.reason
          : null
        msg += `, ${failed} failed${firstErr ? ` (${firstErr})` : ""}`
      }
      toast(msg, failed > 0 ? "x" : "check")
      setSelectedIds(new Set())
      router.refresh()
    },
    [toast, router],
  )

  const runBulkInvoice = React.useCallback(
    (rows: DeliveryV3[]) =>
      runBulkGated(rows, {
        action: "send_invoice",
        ineligibleReason: deliveryBulkInvoiceIneligibleReason,
        label: INVOICE_INELIGIBLE_LABEL,
        confirmTitle: (n) => `Create and send ${n} Square invoice${n !== 1 ? "s" : ""} now?`,
        confirmNote: "Each eligible job gets an enriched invoice emailed to its business contact.",
        emptyNoun: "invoices",
        successVerb: "Sent",
        successNoun: (n) => `invoice${n !== 1 ? "s" : ""}`,
        errorNoun: "send invoices",
      }),
    [runBulkGated],
  )

  const runBulkTracking = React.useCallback(
    (rows: DeliveryV3[]) =>
      runBulkGated(rows, {
        action: "send_tracking",
        ineligibleReason: deliveryTrackingBulkIneligibleReason,
        label: TRACKING_INELIGIBLE_LABEL,
        confirmTitle: (n) => `Send tracking links to ${n} customer${n !== 1 ? "s" : ""} now?`,
        confirmNote: "Each eligible job texts/emails its end customer a live tracking link.",
        emptyNoun: "tracking links",
        successVerb: "Sent tracking to",
        successNoun: (n) => `customer${n !== 1 ? "s" : ""}`,
        errorNoun: "send tracking",
      }),
    [runBulkGated],
  )

  const runBulkPayment = React.useCallback(
    (rows: DeliveryV3[]) =>
      runBulkGated(rows, {
        action: "record_payment",
        ineligibleReason: deliveryPaymentBulkIneligibleReason,
        label: PAYMENT_INELIGIBLE_LABEL,
        confirmTitle: (n) => `Record payment on ${n} job${n !== 1 ? "s" : ""}?`,
        confirmNote: "Marks each eligible job as paid. No card is charged; this records payment already received.",
        emptyNoun: "payments",
        successVerb: "Recorded payment on",
        successNoun: (n) => `job${n !== 1 ? "s" : ""}`,
        errorNoun: "record payment",
      }),
    [runBulkGated],
  )

  const columns = React.useMemo<ColumnDef<DeliveryV3>[]>(
    () => [
      {
        id: "date",
        shortLabel: "Service",
        header: "Service date",
        accessor: (d) => `${d.scheduled_date} ${d.time_slot || ""}`,
        sortable: true,
        width: 130,
        cell: (d) => (
          <div className="min-w-0">
            <div className="yu3-num text-[13px] font-medium text-[var(--yu3-ink-strong)]">
              {formatMoveDate(d.scheduled_date)}
            </div>
            {d.time_slot ? (
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {d.time_slot}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "created_at",
        shortLabel: "Created",
        header: "Create date",
        accessor: (d) => d.created_at || "",
        sortable: true,
        width: 160,
        cell: (d) => (
          <div className="min-w-0">
            <span className="yu3-num text-[12px] text-[var(--yu3-ink)] whitespace-nowrap block truncate">
              {d.created_at ? formatAdminCreatedAt(d.created_at) : ""}
            </span>
          </div>
        ),
      },
      {
        id: "partner",
        shortLabel: "Partner",
        header: "Partner",
        accessor: (d) => d.client_name || "",
        sortable: true,
        width: 200,
        cell: (d) => (
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
              {d.client_name || "-"}
            </div>
            {d.is_multi_stop && d.project_name?.trim() ? (
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                {d.project_name.trim()}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "category",
        header: "Category",
        shortLabel: "Category",
        accessor: (d) => d.category || "delivery",
        sortable: true,
        width: 120,
        cell: (d) => (
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[12px] text-[var(--yu3-ink)]">
              {toTitleCase((d.category || "delivery").replace(/_/g, " "))}
            </span>
            {d.is_multi_stop ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone="info">Multi-stop</StatusPill>
                {d.total_stops != null && d.total_stops > 0 ? (
                  <span className="text-[10px] font-medium text-[var(--yu3-ink-muted)] tabular-nums">
                    {d.total_stops} stops
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "delivery_id",
        shortLabel: "ID",
        header: "Delivery ID",
        accessor: (d) => d.delivery_number || "",
        sortable: true,
        width: 130,
        cell: (d) => (
          <span className="font-mono yu3-num text-[12px] font-semibold text-[var(--yu3-ink-strong)]">
            {d.delivery_number ? formatJobId(d.delivery_number, "delivery") : ""}
          </span>
        ),
      },
      {
        id: "price",
        header: "Price",
        shortLabel: "Price",
        accessor: (d) => d.total_price ?? 0,
        sortable: true,
        width: 160,
        cell: (d) => (
          <span className="text-[12px] leading-snug tabular-nums text-[var(--yu3-ink)] line-clamp-2">
            {formatDeliveryPriceForAdminList(d)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        shortLabel: "Status",
        accessor: (d) => d.status || "",
        sortable: true,
        width: 150,
        cell: (d) => {
          const s = d.status || ""
          const label = toTitleCase(
            s.replace(/_/g, " ").replace(/-/g, " "),
          )
          // Use the shared eligibility helper (2026-06-30) so the list
          // and detail page agree on which deliveries surface a Paid
          // badge. Previously the list only matched B2B-one-off-no-org
          // bookings while the detail page also matched category=b2b
          // and any non-empty vertical_code — so retail / vertical
          // deliveries marked paid (e.g. DLV-30334) showed "Paid
          // (prepaid)" on the detail page but no badge in the list.
          const prepaid =
            !!d.payment_received_at && deliveryEligibleForAdminPrepaidMark(d)
          return (
            <div className="inline-flex flex-wrap items-center gap-1.5 min-w-0">
              <StatusPill tone={deliveryStatusTone(s)}>{label}</StatusPill>
              {prepaid ? (
                <StatusPill tone="success">Paid</StatusPill>
              ) : null}
            </div>
          )
        },
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<DeliveryV3>[]>(
    () => [
      {
        id: "send-invoice",
        label: "Send invoices",
        disabled: (r) =>
          !r.some((d) => deliveryBulkInvoiceIneligibleReason(d) === null),
        run: (r) => runBulkInvoice(r),
      },
      {
        id: "send-tracking",
        label: "Send tracking",
        disabled: (r) =>
          !r.some((d) => deliveryTrackingBulkIneligibleReason(d) === null),
        run: (r) => runBulkTracking(r),
      },
      {
        id: "record-payment",
        label: "Record payment",
        disabled: (r) =>
          !r.some((d) => deliveryPaymentBulkIneligibleReason(d) === null),
        run: (r) => runBulkPayment(r),
      },
      {
        id: "export-selected",
        label: "Export selected",
        run: (r) => exportDeliveriesCsv(r, "deliveries-selected.csv"),
      },
      {
        id: "deliver",
        label: "Mark delivered",
        run: (r) => runBulk("deliver", r.map((d) => d.id)),
      },
      {
        id: "cancel",
        label: "Cancel",
        danger: true,
        run: (r) => runBulk("cancel", r.map((d) => d.id)),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash size={14} />,
        danger: true,
        run: (r) => runBulkDelete(r.map((d) => d.id)),
      },
    ],
    [runBulk, runBulkDelete, runBulkInvoice, runBulkTracking, runBulkPayment],
  )

  const uninvoicedEligibleIds = React.useMemo(
    () => rows.filter((d) => deliveryBulkInvoiceIneligibleReason(d) === null).map((d) => d.id),
    [rows],
  )
  const deliveredUnpaidIds = React.useMemo(
    () => rows.filter((d) => isDeliveredAndUnpaid(d)).map((d) => d.id),
    [rows],
  )

  const smartSelects: { label: string; ids: string[] }[] = [
    { label: "Select all uninvoiced", ids: uninvoicedEligibleIds },
    { label: "Select delivered & unpaid", ids: deliveredUnpaidIds },
  ].filter((s) => s.ids.length > 0)

  return (
    <>
      {smartSelects.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {smartSelects.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSelectedIds(new Set(s.ids))}
              className="inline-flex items-center gap-1.5 rounded-[var(--yu3-r-sm)] border border-[var(--yu3-line)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-sunken)]"
            >
              {s.label}
              <span className="yu3-num text-[11px] font-semibold text-[var(--yu3-ink-muted)]">
                {s.ids.length}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <DataTable<DeliveryV3>
        columns={columns}
        rows={rows}
        rowId={(d) => d.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        onRowClick={(d) => router.push(getDeliveryDetailPath(d))}
        onExport={() => exportDeliveriesCsv(rows, "deliveries.csv")}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
        searchPlaceholder="Search records…"
        emptyState={
          <div className="px-2 py-8 text-center">
            <p className="text-[15px] font-semibold text-[var(--yu3-ink)]">
              {emptyMessage}
            </p>
          </div>
        }
      />
    </>
  )
}
