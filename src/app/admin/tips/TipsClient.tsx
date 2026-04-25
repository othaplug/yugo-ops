"use client"

import * as React from "react"
import Link from "next/link"
import { formatCurrency } from "@/lib/format-currency"
import { formatAdminCreatedAt } from "@/lib/date-format"
import { csvField } from "@/lib/admin-csv-field"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
  type ViewMode,
} from "@/design-system/admin/table"
import SectionDivider from "@/components/ui/SectionDivider"
import { PageHeader } from "@/design-system/admin/layout"
import { KpiStrip } from "@/design-system/admin/dashboard"

interface Tip {
  id: string
  move_id: string
  crew_id: string
  crew_name: string | null
  client_name: string | null
  amount: number
  processing_fee: number | null
  net_amount: number | null
  charged_at: string
  move_code?: string | null
}

interface CrewAllocation {
  id: string
  name: string
  total: number
  count: number
  avg: number
  highest: number
}

export default function TipsClient({
  tips,
  totalTips,
  avgTip,
  tipCount,
  crewAllocations = [],
}: {
  tips: Tip[]
  totalTips: number
  avgTip: number
  tipCount: number
  crewAllocations?: CrewAllocation[]
}) {
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "charged_at",
    direction: "desc",
  })
  const [viewMode, setViewMode] = React.useState<ViewMode>("list")

  const columns = React.useMemo<ColumnDef<Tip>[]>(
    () => [
      {
        id: "client_name",
        shortLabel: "Client",
        header: "Client",
        accessor: (r) => r.client_name ?? "",
        width: 180,
        cell: (r) =>
          r.client_name ? (
            <span className="font-semibold text-[var(--yu3-ink)]">{r.client_name}</span>
          ) : null,
      },
      {
        id: "move",
        header: "Move",
        accessor: (r) => r.move_code || r.move_id || "",
        width: 140,
        cell: (r) =>
          r.move_code ? (
            <Link
              href={`/admin/moves/${r.move_code}`}
              className="text-[12px] font-semibold text-[var(--yu3-ink)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {r.move_code}
            </Link>
          ) : r.move_id ? (
            <Link
              href={`/admin/moves/${r.move_id}`}
              className="text-[12px] font-semibold text-[var(--yu3-ink)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View move
            </Link>
          ) : null,
      },
      {
        id: "crew_name",
        header: "Crew",
        accessor: (r) => r.crew_name ?? "",
        width: 160,
        cell: (r) =>
          r.crew_name ? (
            <span className="text-[var(--yu3-ink-muted)]">{r.crew_name}</span>
          ) : null,
      },
      {
        id: "charged_at",
        shortLabel: "Date",
        header: "Create date",
        accessor: (r) => r.charged_at,
        sortable: true,
        width: 180,
        cell: (r) => formatAdminCreatedAt(r.charged_at),
      },
      {
        id: "amount",
        header: "Amount",
        accessor: (r) => r.amount,
        sortable: true,
        align: "right",
        numeric: true,
        width: 120,
        cell: (r) => (
          <span className="font-semibold text-[var(--yu3-ink)] tabular-nums">
            {formatCurrency(r.amount)}
          </span>
        ),
      },
      {
        id: "processing_fee",
        header: "Fee",
        accessor: (r) => (r.processing_fee != null ? Number(r.processing_fee) : 0),
        sortable: true,
        align: "right",
        numeric: true,
        width: 100,
        cell: (r) =>
          r.processing_fee != null && Number(r.processing_fee) > 0 ? (
            <span className="text-[var(--yu3-ink-muted)] tabular-nums">
              {formatCurrency(Number(r.processing_fee))}
            </span>
          ) : null,
      },
    ],
    [],
  )

  const onExport = React.useCallback(() => {
    const headers = [
      "Client",
      "Move",
      "Crew",
      "Create date",
      "Amount",
      "Fee",
    ]
    const lines = tips.map((r) =>
      [
        r.client_name || "",
        r.move_code || r.move_id || "",
        r.crew_name || "",
        formatAdminCreatedAt(r.charged_at),
        formatCurrency(r.amount),
        r.processing_fee != null && Number(r.processing_fee) > 0
          ? formatCurrency(Number(r.processing_fee))
          : "",
      ]
        .map((c) => csvField(c))
        .join(","),
    )
    const csv = [headers.map(csvField).join(","), ...lines].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "yugo-tips.csv"
    a.click()
    URL.revokeObjectURL(url)
  }, [tips])

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <PageHeader
        eyebrow="Finance"
        title="Tips"
        description="Crew gratuities collected via Square across completed moves."
      />
      <KpiStrip
        tiles={[
          { id: "total", label: "Total collected", value: formatCurrency(totalTips), hint: `${tipCount} gratuities` },
          { id: "avg", label: "Average tip", value: formatCurrency(avgTip), hint: "per completed move" },
          { id: "count", label: "Total count", value: String(tipCount), hint: "all time" },
        ]}
        columns={3}
      />

      {crewAllocations.length > 0 && (
        <>
          <SectionDivider label="Crew Tip Allocation" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {crewAllocations.slice(0, 6).map((crew, i) => (
              <div
                key={crew.id}
                className="rounded-[var(--yu3-r-lg,10px)] border border-[var(--yu3-line,var(--brd))] p-5 bg-[var(--yu3-bg-surface,var(--card))]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold shrink-0 bg-[var(--yu3-bg-surface-sunken,var(--hover))] text-[var(--yu3-ink,var(--tx))] border border-[var(--yu3-line,var(--brd))] tabular-nums">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--yu3-ink-strong,var(--tx))] truncate">{crew.name}</p>
                    <p className="text-[11px] text-[var(--yu3-ink-muted,var(--tx3))]">{crew.count} gratuities</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-left">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--yu3-ink-muted,var(--tx3))] mb-1">Total</p>
                    <p className="text-[15px] font-semibold text-[var(--yu3-ink-strong,var(--tx))] tabular-nums">{formatCurrency(crew.total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--yu3-ink-muted,var(--tx3))] mb-1">Avg</p>
                    <p className="text-[15px] font-semibold text-[var(--yu3-ink-strong,var(--tx))] tabular-nums">{formatCurrency(crew.avg)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--yu3-ink-muted,var(--tx3))] mb-1">Best</p>
                    <p className="text-[15px] font-semibold text-[var(--yu3-ink-strong,var(--tx))] tabular-nums">{formatCurrency(crew.highest)}</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full overflow-hidden bg-[var(--yu3-bg-surface-sunken,var(--hover))]">
                  <div
                    className="h-full rounded-full bg-[var(--yu3-ink-strong,var(--tx))]"
                    style={{
                      width: `${Math.round((crew.total / (crewAllocations[0]?.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionDivider label="Recent Tips" />
      <DataTable<Tip>
        columns={columns}
        rows={tips}
        rowId={(r) => r.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onExport={onExport}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableViews={["list"]}
        searchPlaceholder="Search by client or crew…"
        emptyState={
          <div className="px-2 py-8 text-center">
            <p className="text-[15px] font-semibold text-[var(--yu3-ink)]">
              No tips yet. Tips appear here after clients leave gratuities on completed moves
            </p>
          </div>
        }
      />
    </div>
  )
}
