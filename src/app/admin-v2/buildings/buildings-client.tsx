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
import { Input } from "@/components/admin-v2/primitives/Input"
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
} from "@/components/admin-v2/layout/Modal"
import { BUILDING_CONFIG_LABEL } from "@/lib/admin-v2/labels"
import { downloadCsv } from "@/lib/admin-v2/csv"
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

export type BuildingsClientProps = {
  initialBuildings: Building[]
}

export const BuildingsClient = ({ initialBuildings }: BuildingsClientProps) => {
  const [buildings, setBuildings] = React.useState<Building[]>(
    () => initialBuildings,
  )
  React.useEffect(() => {
    setBuildings(initialBuildings)
  }, [initialBuildings])
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
          downloadCsv(
            ["Building", "Address", "PM Account", "Elevator config", "Complexity", "Moves completed", "Last move"],
            rows.map((r) => [r.name, r.address, r.pmAccountName ?? "", r.elevatorConfig, r.complexity, r.movesCompleted, r.lastMoveAt ?? ""]),
            `yugo-buildings-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} buildings`)
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
          <NewBuildingModal
            onCreated={(building) => setBuildings((prev) => [building, ...prev])}
          />
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
        onComplexityChange={(id, complexity) =>
          setBuildings((prev) =>
            prev.map((b) => b.id === id ? { ...b, complexity: complexity as Building["complexity"] } : b)
          )
        }
      />
    </div>
  )
}

const NewBuildingModal = ({ onCreated }: { onCreated: (building: Building) => void }) => {
  const [open, setOpen] = React.useState(false)
  const [address, setAddress] = React.useState("")
  const [name, setName] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const reset = () => { setAddress(""); setName("") }

  const handleCreate = async () => {
    if (!address.trim()) { toast.error("Address is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/buildings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ address: address.trim(), building_name: name.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create building")
      } else {
        const b = data.building
        const newBuilding: Building = {
          id: b.id,
          name: b.building_name || b.address,
          address: b.address,
          pmAccountId: null,
          pmAccountName: null,
          elevatorConfig: "standard",
          complexity: (b.complexity_rating ?? 1) as Building["complexity"],
          movesCompleted: 0,
          lastMoveAt: null,
        }
        toast.success(`Building created`)
        onCreated(newBuilding)
        setOpen(false)
        reset()
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
      <ModalTrigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<Icon name="plus" size="sm" weight="bold" />}>
          New building
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader title="Add building" description="Enter the building address to add it to the directory." />
        <div className="space-y-3">
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Address *</label>
            <Input
              type="text"
              placeholder="123 Main St, Toronto, ON"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate() }}
            />
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Building name</label>
            <Input
              type="text"
              placeholder="The Grand (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </ModalClose>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleCreate}>
            {saving ? "Creating…" : "Create building"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
