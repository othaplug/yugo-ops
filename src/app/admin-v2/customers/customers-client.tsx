"use client"

import * as React from "react"
import { toast } from "sonner"
import Link from "next/link"
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
import { variantForStatus } from "@/components/admin-v2/primitives/Chip"
import { CustomerDrawer } from "@/components/admin-v2/modules/customer-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import {
  CUSTOMER_TYPE_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import { downloadCsv } from "@/lib/admin-v2/csv"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { Customer, CustomerType, Move, Quote, Invoice } from "@/lib/admin-v2/mock/types"

export type CustomersClientProps = {
  initialCustomers: Customer[]
  moves?: Move[]
  quotes?: Quote[]
  invoices?: Invoice[]
}

export const CustomersClient = ({ initialCustomers, moves = [], quotes = [], invoices = [] }: CustomersClientProps) => {
  const [customers, setCustomers] = React.useState<Customer[]>(() => initialCustomers)
  React.useEffect(() => {
    setCustomers(initialCustomers)
  }, [initialCustomers])
  const [typeFilter, setTypeFilter] = React.useState<CustomerType | "all">("all")

  const filtered = React.useMemo(
    () =>
      typeFilter === "all"
        ? customers
        : customers.filter((c) => c.type === typeFilter),
    [typeFilter, customers],
  )

  const drawer = useDrawer("customer")
  const activeCustomer = React.useMemo(
    () => customers.find((c) => c.id === drawer.id) ?? null,
    [drawer.id, customers],
  )

  const metrics = React.useMemo(() => {
    const b2c = customers.filter((c) => c.type === "b2c").length
    const b2b = customers.filter((c) => c.type === "b2b").length
    const pm = customers.filter((c) => c.type === "pm").length
    const totalLtv = customers.reduce((sum, c) => sum + c.ltv, 0)
    return { b2c, b2b, pm, totalLtv }
  }, [customers])

  const columns = React.useMemo<ColumnConfig<Customer>[]>(
    () => [
      {
        id: "customer",
        type: "identity",
        header: "Customer",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => <TextCell primary={row.name} secondary={row.email} />,
      },
      {
        id: "type",
        type: "chip",
        header: "Type",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.type,
        render: (row) => (
          <ChipCell
            label={CUSTOMER_TYPE_LABEL[row.type]}
            variant={variantForStatus(row.type)}
          />
        ),
      },
      {
        id: "vertical",
        type: "text",
        header: "Vertical",
        priority: "p2",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.vertical ?? "residential",
        render: (row) => (
          <span className="body-sm text-fg">
            {row.vertical ? VERTICAL_LABEL[row.vertical] : "Residential"}
          </span>
        ),
      },
      {
        id: "ltv",
        type: "numeric",
        header: "LTV",
        priority: "p1",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.ltv,
        render: (row) => <NumericCell value={row.ltv} currency />,
      },
      {
        id: "moves",
        type: "numeric",
        header: "Moves",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.movesCount,
        render: (row) => <NumericCell value={row.movesCount} />,
      },
      {
        id: "lastContact",
        type: "date",
        header: "Last contact",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => new Date(row.lastContactAt).getTime(),
        render: (row) => <DateCell value={row.lastContactAt} />,
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<Customer>[]>(
    () => [
      {
        id: "tag",
        label: "Add tag",
        handler: (rows) => {
          toast.info(`Tagging ${rows.length} customers`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          downloadCsv(
            ["Name", "Email", "Phone", "Type", "LTV", "Moves", "Last contact", "Since"],
            rows.map((r) => [r.name, r.email, r.phone, r.type, r.ltv, r.movesCount, r.lastContactAt, r.createdAt]),
            `yugo-customers-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} customers`)
        },
      },
      {
        id: "archive",
        label: "Archive",
        destructive: true,
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setCustomers((prev) => prev.filter((c) => !ids.has(c.id)))
          toast.error(`Archived ${rows.length} customers`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Customers"
        actions={
          <Button variant="secondary" size="sm" leadingIcon={<Icon name="plus" size="sm" weight="bold" />} asChild>
            <Link href={`${ADMIN_V2_BASE}/quotes/new`}>New customer</Link>
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "B2C", value: metrics.b2c.toString() },
          { label: "B2B", value: metrics.b2b.toString() },
          { label: "Property management", value: metrics.pm.toString() },
          {
            label: "Total LTV",
            value: formatCurrencyCompact(metrics.totalLtv),
          },
        ]}
      />

      <div className="flex items-center gap-2">
        {(["all", "b2c", "b2b", "pm"] as const).map((key) => {
          const label =
            key === "all"
              ? "All"
              : key === "b2c"
                ? "B2C"
                : key === "b2b"
                  ? "B2B"
                  : "Property management"
          const active = typeFilter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={
                active
                  ? "inline-flex h-8 items-center rounded-sm bg-fg px-3 body-sm font-medium text-surface"
                  : "inline-flex h-8 items-center rounded-sm border border-line bg-surface px-3 body-sm font-medium text-fg hover:bg-surface-subtle"
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="customers"
        moduleLabel="customers"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <CustomerDrawer
        customer={activeCustomer}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
        moves={moves}
        quotes={quotes}
        invoices={invoices}
      />
    </div>
  )
}
