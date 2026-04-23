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
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { BuildingDrawer } from "@/components/admin-v2/modules/building-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { BUILDING_CONFIG_LABEL } from "@/lib/admin-v2/labels"
import { getMockUniverse } from "@/lib/admin-v2/mock"
import type { Building } from "@/lib/admin-v2/mock/types"
import { cn } from "@/components/admin-v2/lib/cn"

const ComplexityCell = ({
  value,
}: {
  value: Building["complexity"]
}) => (
  <span className="inline-flex items-center gap-1.5">
    {Array.from({ length: 5 }).map((_, index) => (
      <span
        key={index}
        className={cn(
          "h-1 w-2.5 rounded-full",
          index < value ? "bg-accent" : "bg-line-strong",
        )}
      />
    ))}
    <span className="body-xs text-fg-subtle tabular-nums">{value}/5</span>
  </span>
)

export const BuildingsClient = () => {
  const universe = React.useMemo(() => getMockUniverse(), [])
  const [buildings] = React.useState<Building[]>(() => universe.buildings)
  const drawer = useDrawer("building")
  const activeBuilding = React.useMemo(
    () => buildings.find((b) => b.id === drawer.id) ?? null,
    [buildings, drawer.id],
  )

  const metrics = React.useMemo(() => {
    const total = buildings.length
    const highComplex = buildings.filter((b) => b.complexity >= 4).length
    const splitOrMulti = buildings.filter(
      (b) => b.elevatorConfig !== "standard",
    ).length
    const movesTotal = buildings.reduce((s, b) => s + b.movesCompleted, 0)
    return { total, highComplex, splitOrMulti, movesTotal }
  }, [buildings])

  const columns = React.useMemo<ColumnConfig<Building>[]>(
    () => [
      {
        id: "building",
        type: "identity",
        header: "Building",
        priority: "p1",
        minWidth: 240,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <TextCell primary={row.name} secondary={row.address} />
        ),
      },
      {
        id: "pm",
        type: "text",
        header: "PM account",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.pmAccountName ?? "",
        render: (row) => (
          <span className="body-sm text-fg">
            {row.pmAccountName ?? (
              <span className="text-fg-subtle">Independent</span>
            )}
          </span>
        ),
      },
      {
        id: "config",
        type: "chip",
        header: "Elevator",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.elevatorConfig,
        render: (row) => (
          <ChipCell
            label={BUILDING_CONFIG_LABEL[row.elevatorConfig]}
            variant={row.elevatorConfig === "standard" ? "neutral" : "info"}
          />
        ),
      },
      {
        id: "complexity",
        type: "indicator",
        header: "Complexity",
        priority: "p1",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.complexity,
        render: (row) => <ComplexityCell value={row.complexity} />,
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
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<Building>[]>(
    () => [
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} buildings`)
        },
      },
      {
        id: "surcharge",
        label: "Adjust surcharge",
        handler: (rows) => {
          toast.success(`Surcharge review queued for ${rows.length} buildings`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buildings"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("New building flow opens here")}
          >
            New building
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Buildings", value: metrics.total.toString() },
          { label: "Complex (4+)", value: metrics.highComplex.toString() },
          {
            label: "Split / multi elevator",
            value: metrics.splitOrMulti.toString(),
          },
          { label: "Moves completed", value: metrics.movesTotal.toString() },
        ]}
      />

      <DataTable
        data={buildings}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="buildings"
        moduleLabel="buildings"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <BuildingDrawer
        building={activeBuilding}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}
