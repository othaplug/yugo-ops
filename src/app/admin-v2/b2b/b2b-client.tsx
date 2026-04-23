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
import { B2BDrawer } from "@/components/admin-v2/modules/b2b-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import {
  B2B_STATUS_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import type { B2BPartner, Vertical } from "@/lib/admin-v2/mock/types"
import { cn } from "@/components/admin-v2/lib/cn"

const VERTICAL_FILTERS: Array<{ id: "all" | Vertical; label: string }> = [
  { id: "all", label: "All" },
  { id: "furniture_retail", label: "Furniture retail" },
  { id: "flooring", label: "Flooring" },
  { id: "interior_designer", label: "Interior designer" },
  { id: "cabinetry", label: "Cabinetry" },
  { id: "medical_lab", label: "Medical / Lab" },
  { id: "appliance", label: "Appliance" },
  { id: "art_gallery", label: "Art / Gallery" },
  { id: "restaurant_hospitality", label: "Restaurant / Hospitality" },
  { id: "office_commercial", label: "Office / Commercial" },
  { id: "ecommerce_bulk", label: "E-commerce / Bulk" },
  { id: "property_management", label: "Property management" },
]

export type B2BClientProps = {
  initialPartners: B2BPartner[]
}

export const B2BClient = ({ initialPartners }: B2BClientProps) => {
  const [partners, setPartners] = React.useState<B2BPartner[]>(
    () => initialPartners,
  )
  React.useEffect(() => {
    setPartners(initialPartners)
  }, [initialPartners])
  const drawer = useDrawer("b2b")
  const activePartner = React.useMemo(
    () => partners.find((p) => p.id === drawer.id) ?? null,
    [partners, drawer.id],
  )
  const [vertical, setVertical] = React.useState<"all" | Vertical>("all")
  const rows = React.useMemo(
    () =>
      vertical === "all"
        ? partners
        : partners.filter((p) => p.vertical === vertical),
    [partners, vertical],
  )

  const metrics = React.useMemo(() => {
    const active = partners.filter((p) => p.status === "active").length
    const jobs = partners.reduce((s, p) => s + p.jobsLast30, 0)
    const revenue = partners.reduce((s, p) => s + p.revenueLast30, 0)
    const onTime =
      partners.reduce((s, p) => s + p.onTimePercent, 0) /
      (partners.length || 1)
    return { active, jobs, revenue, onTime }
  }, [partners])

  const columns = React.useMemo<ColumnConfig<B2BPartner>[]>(
    () => [
      {
        id: "partner",
        type: "identity",
        header: "Partner",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <TextCell primary={row.name} secondary={row.primaryContact} />
        ),
      },
      {
        id: "vertical",
        type: "chip",
        header: "Vertical",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.vertical,
        render: (row) => (
          <ChipCell label={VERTICAL_LABEL[row.vertical]} variant="neutral" />
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
            label={B2B_STATUS_LABEL[row.status]}
            variant={
              row.status === "active"
                ? "success"
                : row.status === "paused"
                  ? "warning"
                  : "neutral"
            }
          />
        ),
      },
      {
        id: "jobs",
        type: "numeric",
        header: "Jobs 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.jobsLast30,
        render: (row) => <NumericCell value={row.jobsLast30} />,
      },
      {
        id: "revenue",
        type: "numeric",
        header: "Revenue 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.revenueLast30,
        render: (row) => (
          <NumericCell
            value={row.revenueLast30}
            format={formatCurrencyCompact}
          />
        ),
      },
      {
        id: "onTime",
        type: "numeric",
        header: "On-time",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.onTimePercent,
        render: (row) => (
          <NumericCell value={row.onTimePercent} precision={1} />
        ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<B2BPartner>[]>(
    () => [
      {
        id: "statement",
        label: "Generate statement",
        handler: (rows) => {
          toast.success(`Statements queued for ${rows.length} partners`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} partners`)
        },
      },
      {
        id: "pause",
        label: "Pause partner",
        destructive: true,
        handler: (rows) => {
          toast.error(`Paused ${rows.length} partners`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="B2B partners"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("New partner flow opens here")}
          >
            New partner
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Active partners", value: metrics.active.toString() },
          { label: "Jobs (30d)", value: metrics.jobs.toString() },
          {
            label: "Revenue (30d)",
            value: formatCurrencyCompact(metrics.revenue),
          },
          {
            label: "On-time",
            value: `${metrics.onTime.toFixed(1)}%`,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2">
        {VERTICAL_FILTERS.map((filter) => {
          const active = vertical === filter.id
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setVertical(filter.id)}
              className={cn(
                "rounded-full border px-3 py-1 label-sm transition-colors",
                active
                  ? "border-transparent bg-fg text-surface"
                  : "border-line bg-surface text-fg hover:bg-surface-subtle",
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="b2b"
        moduleLabel="partners"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <B2BDrawer
        partner={activePartner}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}
