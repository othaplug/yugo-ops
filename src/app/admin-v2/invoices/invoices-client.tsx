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
import { InvoiceDrawer } from "@/components/admin-v2/modules/invoice-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { INVOICE_STATUS_LABEL } from "@/lib/admin-v2/labels"
import { formatCurrency, formatCurrencyCompact } from "@/lib/admin-v2/format"
import type { Invoice } from "@/lib/admin-v2/mock/types"

export type InvoicesClientProps = {
  initialInvoices: Invoice[]
}

export const InvoicesClient = ({ initialInvoices }: InvoicesClientProps) => {
  const [invoices, setInvoices] = React.useState<Invoice[]>(() => initialInvoices)
  React.useEffect(() => {
    setInvoices(initialInvoices)
  }, [initialInvoices])
  const drawer = useDrawer("invoice")
  const activeInvoice = React.useMemo(
    () => invoices.find((i) => i.id === drawer.id) ?? null,
    [drawer.id, invoices],
  )

  const metrics = React.useMemo(() => {
    const paid = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.total, 0)
    const outstanding = invoices
      .filter((i) => i.status === "sent")
      .reduce((s, i) => s + i.total, 0)
    const overdue = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + i.total, 0)
    const count = invoices.length
    return { paid, outstanding, overdue, count }
  }, [invoices])

  const columns = React.useMemo<ColumnConfig<Invoice>[]>(
    () => [
      {
        id: "invoice",
        type: "identity",
        header: "Invoice",
        priority: "p1",
        minWidth: 200,
        sortable: true,
        filterable: true,
        value: (row) => row.number,
        render: (row) => (
          <TextCell primary={row.number} secondary={row.customerName} />
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
            label={INVOICE_STATUS_LABEL[row.status]}
            variant={
              row.status === "paid"
                ? "success"
                : row.status === "overdue"
                  ? "danger"
                  : row.status === "sent"
                    ? "info"
                    : "neutral"
            }
          />
        ),
      },
      {
        id: "total",
        type: "numeric",
        header: "Total",
        priority: "p1",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.total,
        render: (row) => <NumericCell value={row.total} currency />,
      },
      {
        id: "due",
        type: "date",
        header: "Due",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => new Date(row.dueAt).getTime(),
        render: (row) => <DateCell value={row.dueAt} />,
      },
      {
        id: "paid",
        type: "date",
        header: "Paid",
        priority: "p3",
        sortable: true,
        filterable: true,
        value: (row) => (row.paidAt ? new Date(row.paidAt).getTime() : 0),
        render: (row) =>
          row.paidAt ? (
            <DateCell value={row.paidAt} />
          ) : (
            <span className="body-sm text-fg-subtle">–</span>
          ),
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<Invoice>[]>(
    () => [
      {
        id: "send",
        label: "Send",
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setInvoices((prev) =>
            prev.map((inv) => (ids.has(inv.id) ? { ...inv, status: "sent" } : inv)),
          )
          toast.success(`Sent ${rows.length} invoices`)
        },
      },
      {
        id: "paid",
        label: "Mark paid",
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setInvoices((prev) =>
            prev.map((inv) =>
              ids.has(inv.id)
                ? { ...inv, status: "paid", paidAt: new Date().toISOString() }
                : inv,
            ),
          )
          toast.success(`${rows.length} invoices marked paid`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} invoices`)
        },
      },
      {
        id: "void",
        label: "Void",
        destructive: true,
        handler: (rows) => {
          toast.error(`Voided ${rows.length} invoices`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("New invoice flow opens here")}
          >
            New invoice
          </Button>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Paid MTD",
            value: formatCurrencyCompact(metrics.paid),
          },
          {
            label: "Outstanding",
            value: formatCurrencyCompact(metrics.outstanding),
          },
          {
            label: "Overdue",
            value: formatCurrency(metrics.overdue),
          },
          {
            label: "Invoices",
            value: metrics.count.toString(),
          },
        ]}
      />

      <DataTable
        data={invoices}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="invoices"
        moduleLabel="invoices"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <InvoiceDrawer
        invoice={activeInvoice}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}
