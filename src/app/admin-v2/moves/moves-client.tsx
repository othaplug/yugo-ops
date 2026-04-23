"use client"

import * as React from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import { AvatarStack } from "@/components/admin-v2/primitives/AvatarStack"
import {
  ChipCell,
  DataTable,
  DateCell,
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { variantForStatus } from "@/components/admin-v2/primitives/Chip"
import { MoveDrawer } from "@/components/admin-v2/modules/move-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import {
  MOVE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  TIER_LABEL,
} from "@/lib/admin-v2/labels"
import { formatCurrencyCompact, formatPercent } from "@/lib/admin-v2/format"
import { getMockUniverse } from "@/lib/admin-v2/mock"
import type { Move } from "@/lib/admin-v2/mock/types"

const DAY_MS = 24 * 60 * 60 * 1000

export const MovesClient = () => {
  const universe = React.useMemo(() => getMockUniverse(), [])
  const [moves, setMoves] = React.useState<Move[]>(() => universe.moves)
  const drawer = useDrawer("move")
  const activeMove = React.useMemo(
    () => moves.find((m) => m.id === drawer.id) ?? null,
    [drawer.id, moves],
  )

  const metrics = React.useMemo(() => {
    const now = Date.now()
    const today = moves.filter((m) => {
      const diff = new Date(m.scheduledAt).getTime() - now
      return Math.abs(diff) < DAY_MS
    }).length
    const week = moves.filter((m) => {
      const diff = new Date(m.scheduledAt).getTime() - now
      return diff > 0 && diff < 7 * DAY_MS
    }).length
    const completed = moves.filter((m) => m.status === "completed")
    const onTimePct = completed.length
      ? (completed.filter((m) => m.onTime).length / completed.length) * 100
      : 100
    const atRisk = moves.filter((m) => m.status === "pre-move" && !m.onTime).length
    const revenueBooked = moves
      .filter((m) => ["scheduled", "pre-move", "in-transit", "completed"].includes(m.status))
      .reduce((sum, m) => sum + m.total, 0)
    return { today, week, onTimePct, atRisk, revenueBooked }
  }, [moves])

  const columns = React.useMemo<ColumnConfig<Move>[]>(
    () => [
      {
        id: "move",
        type: "identity",
        header: "Move",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.number,
        render: (row) => (
          <TextCell primary={row.number} secondary={row.customerName} />
        ),
      },
      {
        id: "tier",
        type: "chip",
        header: "Tier",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.tier,
        render: (row) => {
          const variant =
            row.tier === "estate"
              ? "brand"
              : row.tier === "signature"
                ? "info"
                : "neutral"
          return <ChipCell label={TIER_LABEL[row.tier]} variant={variant} />
        },
      },
      {
        id: "service",
        type: "chip",
        header: "Service",
        priority: "p2",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.serviceType,
        render: (row) => (
          <ChipCell label={SERVICE_TYPE_LABEL[row.serviceType]} variant="neutral" />
        ),
      },
      {
        id: "status",
        type: "chip",
        header: "Status",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.status,
        render: (row) => (
          <ChipCell
            label={MOVE_STATUS_LABEL[row.status]}
            variant={variantForStatus(row.status)}
          />
        ),
      },
      {
        id: "scheduledAt",
        type: "date",
        header: "Scheduled",
        priority: "p1",
        sortable: true,
        filterable: true,
        defaultSort: "asc",
        value: (row) => new Date(row.scheduledAt).getTime(),
        render: (row) => <DateCell value={row.scheduledAt} />,
      },
      {
        id: "crew",
        type: "text",
        header: "Crew",
        priority: "p2",
        sortable: false,
        filterable: false,
        render: (row) =>
          row.crew.length ? (
            <AvatarStack
              items={row.crew.map((c) => ({ name: c.name }))}
              max={3}
              size="sm"
            />
          ) : (
            <span className="body-sm text-fg-subtle">Unassigned</span>
          ),
      },
      {
        id: "total",
        type: "numeric",
        header: "Total",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.total,
        render: (row) => <NumericCell value={row.total} currency />,
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<Move>[]>(
    () => [
      {
        id: "dispatch",
        label: "Dispatch",
        handler: (rows) => {
          toast.success(`Dispatched ${rows.length} moves`)
        },
      },
      {
        id: "reassign",
        label: "Reassign crew",
        handler: (rows) => {
          toast.info(`Crew picker for ${rows.length} moves`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} moves`)
        },
      },
      {
        id: "cancel",
        label: "Cancel moves",
        destructive: true,
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setMoves((prev) =>
            prev.map((m) => (ids.has(m.id) ? { ...m, status: "cancelled" } : m)),
          )
          toast.error(`Cancelled ${rows.length} moves`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Moves"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("New move wizard opens here")}
          >
            New move
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Today", value: metrics.today.toString() },
          { label: "This week", value: metrics.week.toString() },
          {
            label: "On-time",
            value: formatPercent(metrics.onTimePct, 0),
            delta: {
              value: metrics.onTimePct >= 90 ? "+1.2%" : "-2.4%",
              direction: metrics.onTimePct >= 90 ? "up" : "down",
            },
          },
          {
            label: "Revenue booked",
            value: formatCurrencyCompact(metrics.revenueBooked),
          },
        ]}
      />

      <DataTable
        data={moves}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="moves"
        moduleLabel="moves"
        bulkActions={bulkActions}
        viewModes={["list", "board"]}
        savedViews={[
          {
            id: "today",
            label: "Today",
            filters: [],
            sort: [{ columnId: "scheduledAt", direction: "asc" }],
          },
          {
            id: "at-risk",
            label: "At risk",
            filters: [{ columnId: "status", operator: "is", value: "pre-move" }],
            sort: [{ columnId: "scheduledAt", direction: "asc" }],
          },
          {
            id: "completed",
            label: "Completed",
            filters: [{ columnId: "status", operator: "is", value: "completed" }],
            sort: [{ columnId: "scheduledAt", direction: "desc" }],
          },
        ]}
        renderBoard={(rows) => <MovesBoard rows={rows} onOpen={drawer.open} />}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <MoveDrawer
        move={activeMove}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}

const BOARD_ORDER: Move["status"][] = [
  "scheduled",
  "pre-move",
  "in-transit",
  "completed",
  "cancelled",
]

const MovesBoard = ({
  rows,
  onOpen,
}: {
  rows: Move[]
  onOpen: (id: string) => void
}) => {
  const byStatus = React.useMemo(() => {
    const map = new Map<Move["status"], Move[]>()
    for (const status of BOARD_ORDER) map.set(status, [])
    for (const row of rows) {
      const bucket = map.get(row.status)
      if (bucket) bucket.push(row)
    }
    return map
  }, [rows])

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {BOARD_ORDER.map((status) => {
        const items = byStatus.get(status) ?? []
        return (
          <section
            key={status}
            className="flex flex-col gap-3 rounded-md border border-line bg-surface-subtle p-3"
          >
            <header className="flex items-center justify-between">
              <span className="label-sm text-fg-subtle uppercase tracking-[0.08em]">
                {MOVE_STATUS_LABEL[status]}
              </span>
              <span className="label-sm text-fg-muted tabular-nums">
                {items.length}
              </span>
            </header>
            <ul className="flex flex-col gap-2">
              {items.slice(0, 8).map((move) => (
                <li key={move.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(move.id)}
                    className="flex w-full flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong hover:shadow-sm"
                  >
                    <span className="body-sm font-medium text-fg truncate">
                      {move.number} · {move.customerName}
                    </span>
                    <span className="body-xs text-fg-subtle truncate">
                      {TIER_LABEL[move.tier]} · {move.crew.length} crew
                    </span>
                  </button>
                </li>
              ))}
              {items.length > 8 ? (
                <li className="body-xs text-fg-subtle px-3 py-1">
                  +{items.length - 8} more
                </li>
              ) : null}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
