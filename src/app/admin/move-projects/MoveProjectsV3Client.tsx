"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatMoveDate } from "@/lib/date-format"
import { formatCurrency } from "@/lib/format-currency"

import { PageHeader } from "@/design-system/admin/layout"
import { Button, StatusPill } from "@/design-system/admin/primitives"
import {
  DataTable,
  type ColumnDef,
  type ColumnSort,
} from "@/design-system/admin/table"
import { KpiStrip } from "@/design-system/admin/dashboard"
import { Plus, CalendarCheck } from "@phosphor-icons/react"

export type MoveProjectRow = {
  id: string
  project_name: string
  status: string
  start_date: string | null
  end_date: string | null
  total_days: number | null
  total_price: number | null
  updated_at: string | null
}

function statusTone(
  s: string,
): React.ComponentProps<typeof StatusPill>["tone"] {
  switch (s) {
    case "completed":
    case "confirmed":
      return "success"
    case "in_progress":
    case "scheduled":
      return "info"
    case "cancelled":
    case "expired":
      return "danger"
    case "quoted":
    case "draft":
    default:
      return "neutral"
  }
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export default function MoveProjectsV3Client({
  rows,
}: {
  rows: MoveProjectRow[]
}) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [sort, setSort] = React.useState<ColumnSort | null>({
    columnId: "start_date",
    direction: "desc",
  })

  const kpis = React.useMemo(() => {
    const totalDays = rows.reduce((a, r) => a + (r.total_days ?? 0), 0)
    const totalValue = rows.reduce((a, r) => a + (Number(r.total_price) || 0), 0)
    const active = rows.filter((r) =>
      ["in_progress", "confirmed", "quoted"].includes(r.status),
    ).length
    return [
      { id: "total", label: "Projects", value: rows.length.toString() },
      { id: "active", label: "Active", value: active.toString() },
      { id: "days", label: "Total days", value: totalDays.toString() },
      { id: "value", label: "Total value", value: formatCurrency(totalValue) },
    ]
  }, [rows])

  const columns = React.useMemo<ColumnDef<MoveProjectRow>[]>(
    () => [
      {
        id: "project_name",
        header: "Project",
        accessor: (r) => r.project_name,
        sortable: true,
        searchable: true,
        width: 300,
        cell: (r) => (
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] truncate">
              {r.project_name}
            </div>
            <div className="text-[11px] text-[var(--yu3-ink-muted)] truncate">
              {r.start_date ? formatMoveDate(r.start_date) : "—"}
              {r.end_date ? ` → ${formatMoveDate(r.end_date)}` : ""}
            </div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (r) => r.status,
        sortable: true,
        width: 140,
        cell: (r) => (
          <StatusPill tone={statusTone(r.status)}>
            {STATUS_LABEL[r.status] ?? r.status}
          </StatusPill>
        ),
      },
      {
        id: "timeline",
        header: "Timeline",
        accessor: (r) => r.total_days ?? 0,
        sortable: true,
        width: 260,
        cell: (r) => (
          <TimelineBar
            startISO={r.start_date}
            endISO={r.end_date}
            days={r.total_days}
            status={r.status}
          />
        ),
      },
      {
        id: "total_days",
        header: "Days",
        accessor: (r) => r.total_days ?? 0,
        align: "right",
        numeric: true,
        sortable: true,
        width: 90,
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink)]">
            {r.total_days ?? "—"}
          </span>
        ),
      },
      {
        id: "total_price",
        header: "Value",
        accessor: (r) => Number(r.total_price || 0),
        align: "right",
        numeric: true,
        sortable: true,
        width: 140,
        cell: (r) =>
          r.total_price ? (
            <span className="yu3-num text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
              {formatCurrency(Number(r.total_price))}
            </span>
          ) : (
            <span className="text-[var(--yu3-ink-faint)]">—</span>
          ),
      },
      {
        id: "start_date",
        header: "Starts",
        accessor: (r) => r.start_date ?? "",
        sortable: true,
        width: 130,
        cell: (r) => (
          <span className="yu3-num text-[12px] text-[var(--yu3-ink-muted)]">
            {r.start_date ? formatMoveDate(r.start_date) : "—"}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Moves"
        title="Move projects"
        description="Multi-day residential and estate schedules linked to quotes."
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<CalendarCheck size={16} />}
              onClick={() => router.push("/admin/calendar")}
            >
              Calendar
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Plus size={16} />}
              onClick={() => router.push("/admin/moves/new?mode=estate")}
            >
              New project
            </Button>
          </>
        }
      />
      <KpiStrip tiles={kpis} columns={4} />
      <DataTable<MoveProjectRow>
        columns={columns}
        rows={rows}
        rowId={(r) => r.id}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(r) => router.push(`/admin/move-projects/${r.id}`)}
      />
    </div>
  )
}

function TimelineBar({
  startISO,
  endISO,
  days,
  status,
}: {
  startISO: string | null
  endISO: string | null
  days: number | null
  status: string
}) {
  if (!startISO || !endISO || !days || days <= 0) {
    return <span className="text-[var(--yu3-ink-faint)] text-[12px]">—</span>
  }
  const start = new Date(startISO).getTime()
  const end = new Date(endISO).getTime()
  const now = Date.now()
  const total = Math.max(1, end - start)
  const rawPct = ((now - start) / total) * 100
  const pct = Math.max(0, Math.min(100, rawPct))
  const isDone = status === "completed"
  const isActive = status === "in_progress"
  const fillColor = isDone
    ? "var(--yu3-success)"
    : isActive
      ? "var(--yu3-wine)"
      : "var(--yu3-line-strong)"
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--yu3-line-subtle)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${isDone ? 100 : pct}%`,
            background: fillColor,
          }}
        />
      </div>
      <span className="yu3-num text-[11px] text-[var(--yu3-ink-muted)] whitespace-nowrap">
        {days}d
      </span>
    </div>
  )
}
