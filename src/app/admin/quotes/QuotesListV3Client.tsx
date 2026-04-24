"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/format-currency"
import { formatAdminCreatedAt } from "@/lib/date-format"
import { toTitleCase } from "@/lib/format-text"
import { serviceTypeDisplayLabel } from "@/lib/displayLabels"
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility"

import { PageHeader } from "@/design-system/admin/layout"
import { Button, StatusPill } from "@/design-system/admin/primitives"
import {
  DataTable,
  type ColumnDef,
  type BulkAction,
  type ColumnSort,
  type RowAction,
  type ViewMode,
} from "@/design-system/admin/table"
import { KpiStrip } from "@/design-system/admin/dashboard"
import {
  PaperPlaneTilt,
  Trash,
  Plus,
  Copy,
} from "@phosphor-icons/react"
import { useToast } from "../components/Toast"

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Quote {
  id: string
  quote_id: string
  contact_id: string
  client_name: string
  service_type: string
  status: string
  tiers: unknown
  custom_price: number | null
  recommended_tier: string | null
  from_address?: string
  to_address?: string
  move_date?: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  expires_at: string | null
  created_at: string
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function quoteAmountRaw(q: Quote): number | null {
  if (q.custom_price) return q.custom_price
  if (q.tiers && typeof q.tiers === "object") {
    const tiers = q.tiers as Record<string, { total?: number }>
    const recKey = (q.recommended_tier ?? "signature").toString().toLowerCase().trim()
    const recommended = tiers[recKey]?.total
    if (recommended != null) return recommended
    const first = Object.values(tiers).find((t) => t?.total)
    if (first?.total) return first.total
  }
  return null
}

function quoteAmount(q: Quote): string {
  const raw = quoteAmountRaw(q)
  return raw != null ? formatCurrency(raw) : ""
}

function relTime(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return `${d}d ago`
}

function expiryInfo(
  expiresAt: string | null,
  status: string,
): { label: string; tone: "warning" | "danger" | "neutral" } | null {
  if (!expiresAt || status === "accepted") return null
  const daysLeft = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / 86_400_000,
  )
  if (daysLeft <= 0) return { label: "Expired", tone: "danger" }
  if (daysLeft <= 2) return { label: `${daysLeft}d left`, tone: "danger" }
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, tone: "warning" }
  return null
}

function statusTone(
  status: string,
): "wine" | "forest" | "neutral" | "warning" | "success" | "danger" | "info" {
  switch (status) {
    case "accepted":
      return "success"
    case "viewed":
    case "sent":
      return "info"
    case "declined":
    case "expired":
      return "danger"
    case "cold":
    case "draft":
      return "neutral"
    default:
      return "neutral"
  }
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function QuotesListV3Client({
  quotes,
  isSuperAdmin = false,
}: {
  quotes: Quote[]
  isSuperAdmin?: boolean
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

  const kpis = React.useMemo(() => {
    const total = quotes.length
    const open = quotes.filter((q) =>
      ["draft", "sent", "viewed"].includes(q.status),
    )
    const openValue = open.reduce((a, q) => a + (quoteAmountRaw(q) ?? 0), 0)
    const accepted = quotes.filter((q) => q.status === "accepted").length
    const expiring = quotes.filter((q) => {
      const i = expiryInfo(q.expires_at, q.status)
      return i?.tone === "danger" || i?.tone === "warning"
    }).length
    return [
      {
        id: "total",
        label: "Total quotes",
        value: total.toString(),
      },
      {
        id: "open",
        label: "Open",
        value: open.length.toString(),
        hint: `${open.length} drafting / sent / viewed`,
      },
      {
        id: "open-value",
        label: "Open value",
        value: formatCurrency(openValue),
      },
      {
        id: "accepted",
        label: "Accepted",
        value: accepted.toString(),
        hint: `${expiring} expiring soon`,
      },
    ]
  }, [quotes])

  const columns = React.useMemo<ColumnDef<Quote>[]>(
    () => [
      {
        id: "quote_id",
        header: "Quote",
        accessor: (q) => q.quote_id,
        sortable: true,
        searchable: true,
        width: 140,
        cell: (q) => (
          <span className="yu3-num text-[13px] font-medium text-[var(--yu3-ink-strong)]">
            {q.quote_id || ""}
          </span>
        ),
      },
      {
        id: "client",
        header: "Client",
        accessor: (q) => q.client_name,
        sortable: true,
        searchable: true,
        width: 220,
        cell: (q) => (
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--yu3-ink-strong)] truncate">
              {q.client_name || "Unnamed client"}
            </div>
            {q.from_address ? (
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
                {q.from_address}
                {q.to_address ? ` → ${q.to_address}` : ""}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        id: "service",
        header: "Service",
        accessor: (q) => q.service_type,
        sortable: true,
        searchable: true,
        width: 140,
        cell: (q) => (
          <span className="text-[12px] text-[var(--yu3-ink)]">
            {serviceTypeDisplayLabel(q.service_type) || ""}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (q) => q.status,
        sortable: true,
        width: 160,
        cell: (q) => {
          const expiry = expiryInfo(q.expires_at, q.status)
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusPill tone={statusTone(q.status)}>
                {toTitleCase(q.status)}
              </StatusPill>
              {expiry ? (
                <StatusPill tone={expiry.tone}>{expiry.label}</StatusPill>
              ) : null}
            </div>
          )
        },
      },
      {
        id: "sent",
        header: "Sent",
        accessor: (q) => q.sent_at || q.created_at,
        sortable: true,
        width: 120,
        cell: (q) => (
          <span className="text-[12px] text-[var(--yu3-ink-muted)] yu3-num">
            {relTime(q.sent_at || q.created_at)}
          </span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessor: (q) => quoteAmountRaw(q) ?? 0,
        align: "right",
        sortable: true,
        width: 130,
        cell: (q) => (
          <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
            {quoteAmount(q)}
          </span>
        ),
      },
      {
        id: "created_at",
        header: "Created",
        accessor: (q) => q.created_at,
        sortable: true,
        width: 140,
        cell: (q) => (
          <span className="text-[12px] text-[var(--yu3-ink-muted)] yu3-num whitespace-nowrap">
            {formatAdminCreatedAt(q.created_at)}
          </span>
        ),
      },
    ],
    [],
  )

  const runBulk = React.useCallback(
    async (
      action: "resend" | "expire" | "delete",
      ids: string[],
    ) => {
      if (action === "delete") {
        if (
          !window.confirm(
            `Permanently delete ${ids.length} quote${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
          )
        )
          return
      }
      const res = await fetch("/api/admin/quotes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        const labels: Record<string, string> = {
          resend: "Resent",
          expire: "Expired",
          delete: "Deleted",
        }
        const count =
          typeof data.updated === "number"
            ? data.updated
            : typeof data.deleted === "number"
              ? data.deleted
              : ids.length
        toast(
          `${labels[action]} ${count} quote${count === 1 ? "" : "s"}`,
          "check",
        )
        setSelectedIds(new Set())
        router.refresh()
      } else {
        toast("Error: " + (data.error || "Failed"), "x")
      }
    },
    [router, toast],
  )

  const bulkActions = React.useMemo<BulkAction<Quote>[]>(
    () => [
      {
        id: "resend",
        label: "Resend",
        icon: <PaperPlaneTilt size={14} />,
        run: (rows) => runBulk("resend", rows.map((r) => r.id)),
      },
      {
        id: "expire",
        label: "Mark expired",
        run: (rows) => runBulk("expire", rows.map((r) => r.id)),
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash size={14} />,
        danger: true,
        run: (rows) => runBulk("delete", rows.map((r) => r.id)),
      },
    ],
    [runBulk],
  )

  const rowActions = React.useMemo<RowAction<Quote>[]>(
    () => [
      {
        id: "open",
        label: "Open quote",
        run: (r) => router.push(`/admin/quotes/${r.id}`),
      },
      {
        id: "edit",
        label: "Edit",
        run: (r) => router.push(`/admin/quotes/${r.id}/edit`),
      },
      {
        id: "copy-link",
        label: "Copy client link",
        icon: <Copy size={14} />,
        run: async (r) => {
          const url = `${location.origin}/quote/${r.id}`
          await navigator.clipboard.writeText(url).catch(() => null)
          toast("Link copied", "check")
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: <Trash size={14} />,
        danger: true,
        run: async (r) => {
          if (!quoteStatusAllowsHardDelete(r.status, isSuperAdmin)) {
            toast("This quote cannot be deleted", "x")
            return
          }
          if (!window.confirm("Delete this quote?")) return
          const res = await fetch(`/api/admin/quotes/${r.id}`, {
            method: "DELETE",
          })
          if (res.ok) {
            toast("Quote deleted", "check")
            router.refresh()
          } else {
            toast("Failed to delete", "x")
          }
        },
      },
    ],
    [isSuperAdmin, router, toast],
  )

  const pipelineStages = React.useMemo(
    () => [
      { id: "draft", label: "Draft", tone: "neutral" as const },
      { id: "sent", label: "Sent", tone: "wine" as const },
      { id: "viewed", label: "Viewed", tone: "info" as const },
      { id: "accepted", label: "Accepted", tone: "success" as const },
      { id: "expired", label: "Expired", tone: "danger" as const },
      { id: "declined", label: "Declined", tone: "danger" as const },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Pipeline"
        title="Quotes"
        description="Track every quote from draft to accepted. Send reminders in bulk."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={16} />}
            onClick={() => router.push("/admin/quotes/new")}
          >
            New quote
          </Button>
        }
      />

      <KpiStrip tiles={kpis} columns={4} />

      <DataTable<Quote>
        columns={columns}
        rows={quotes}
        rowId={(q) => q.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        selectedRowIds={selectedIds}
        onSelectedRowIdsChange={setSelectedIds}
        bulkActions={bulkActions}
        rowActions={rowActions}
        onRowClick={(q) => router.push(`/admin/quotes/${q.id}`)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list", "pipeline"]}
        pipeline={{
          stages: pipelineStages,
          stageForRow: (q) => q.status,
          renderCard: (q) => (
            <div className="bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] rounded-[var(--yu3-r-md)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="yu3-num text-[12px] font-semibold text-[var(--yu3-ink-strong)]">
                  {q.quote_id}
                </span>
                <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
                  {quoteAmount(q)}
                </span>
              </div>
              <div className="mt-1 text-[13px] font-medium text-[var(--yu3-ink)] truncate">
                {q.client_name || "Unnamed client"}
              </div>
              <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate mt-0.5">
                {serviceTypeDisplayLabel(q.service_type) || ""}
              </div>
            </div>
          ),
        }}
      />
    </div>
  )
}
