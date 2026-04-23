"use client"

import * as React from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import {
  ChipCell,
  DataTable,
  DateCell,
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { CrewDrawer } from "@/components/admin-v2/modules/crew-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import {
  CREW_AVAILABILITY_LABEL,
  CREW_ROLE_LABEL,
} from "@/lib/admin-v2/labels"
import { formatPercent } from "@/lib/admin-v2/format"
import type { CrewMember } from "@/lib/admin-v2/mock/types"

export type CrewClientProps = {
  initialCrew: CrewMember[]
}

export const CrewClient = ({ initialCrew }: CrewClientProps) => {
  const [crew, setCrew] = React.useState<CrewMember[]>(() => initialCrew)
  React.useEffect(() => {
    setCrew(initialCrew)
  }, [initialCrew])
  const drawer = useDrawer("crew")
  const activeMember = React.useMemo(
    () => crew.find((c) => c.id === drawer.id) ?? null,
    [drawer.id, crew],
  )

  const metrics = React.useMemo(() => {
    const available = crew.filter((c) => c.availability === "available").length
    const onMove = crew.filter((c) => c.availability === "on-move").length
    const off = crew.filter((c) => c.availability === "off-duty").length
    const avgRating =
      crew.reduce((sum, c) => sum + c.rating, 0) / (crew.length || 1)
    return { available, onMove, off, avgRating }
  }, [crew])

  const columns = React.useMemo<ColumnConfig<CrewMember>[]>(
    () => [
      {
        id: "crew",
        type: "identity",
        header: "Crew",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => <TextCell primary={row.name} secondary={row.email} />,
      },
      {
        id: "role",
        type: "chip",
        header: "Role",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.role,
        render: (row) => (
          <ChipCell label={CREW_ROLE_LABEL[row.role]} variant="neutral" />
        ),
      },
      {
        id: "availability",
        type: "chip",
        header: "Availability",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.availability,
        render: (row) => (
          <ChipCell
            label={CREW_AVAILABILITY_LABEL[row.availability]}
            variant={
              row.availability === "available"
                ? "success"
                : row.availability === "on-move"
                  ? "info"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "rating",
        type: "numeric",
        header: "Rating",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.rating,
        render: (row) => (
          <NumericCell value={row.rating} precision={1} />
        ),
      },
      {
        id: "moves",
        type: "numeric",
        header: "Moves",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.movesCompleted,
        render: (row) => <NumericCell value={row.movesCompleted} />,
      },
      {
        id: "damage",
        type: "numeric",
        header: "Damage",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.damageRate,
        render: (row) => (
          <NumericCell value={row.damageRate} precision={2} />
        ),
      },
      {
        id: "next",
        type: "date",
        header: "Next shift",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) =>
          row.nextAssignmentAt ? new Date(row.nextAssignmentAt).getTime() : 0,
        render: (row) =>
          row.nextAssignmentAt ? (
            <DateCell value={row.nextAssignmentAt} />
          ) : (
            <span className="body-sm text-fg-subtle">Unscheduled</span>
          ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<CrewMember>[]>(
    () => [
      {
        id: "message",
        label: "Message",
        handler: (rows) => {
          toast.info(`Messaging ${rows.length} crew`)
        },
      },
      {
        id: "off",
        label: "Set off duty",
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setCrew((prev) =>
            prev.map((c) =>
              ids.has(c.id) ? { ...c, availability: "off-duty" } : c,
            ),
          )
          toast.success(`${rows.length} crew set off duty`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} crew`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crew"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("Invite crew flow opens here")}
          >
            New crew
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Available", value: metrics.available.toString() },
          { label: "On move", value: metrics.onMove.toString() },
          { label: "Off duty", value: metrics.off.toString() },
          {
            label: "Avg rating",
            value: metrics.avgRating.toFixed(1),
          },
        ]}
      />

      <DataTable
        data={crew}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="crew"
        moduleLabel="crew"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <CrewDrawer
        crew={activeMember}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}
