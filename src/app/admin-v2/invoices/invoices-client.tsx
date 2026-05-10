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
import { Input } from "@/components/admin-v2/primitives/Input"
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTrigger,
} from "@/components/admin-v2/layout/Modal"
import { INVOICE_STATUS_LABEL } from "@/lib/admin-v2/labels"
import { formatCurrency, formatCurrencyCompact } from "@/lib/admin-v2/format"
import { downloadCsv } from "@/lib/admin-v2/csv"
import type { Invoice, Move } from "@/lib/admin-v2/mock/types"

async function bulkInvoiceAction(action: "mark_paid" | "cancel" | "send", ids: string[]): Promise<{ ok: boolean; error?: string }> {
  if (action === "send") {
    // No bulk send endpoint; patch each individually
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/invoices/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ status: "sent" }),
        }).then((r) => r.ok),
      ),
    )
    return results.every(Boolean) ? { ok: true } : { ok: false, error: "Some invoices failed to send" }
  }
  try {
    const res = await fetch("/api/admin/invoices/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, ids }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

export type InvoicesClientProps = {
  initialInvoices: Invoice[]
  moves?: Move[]
}

export const InvoicesClient = ({ initialInvoices, moves = [] }: InvoicesClientProps) => {
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
        handler: async (rows) => {
          const ids = rows.map((r) => r.id)
          const result = await bulkInvoiceAction("send", ids)
          if (result.ok) {
            const idSet = new Set(ids)
            setInvoices((prev) =>
              prev.map((inv) => idSet.has(inv.id) ? { ...inv, status: "sent" as Invoice["status"] } : inv),
            )
            toast.success(`Sent ${rows.length} invoices`)
          } else {
            toast.error(result.error ?? "Failed to send invoices")
          }
        },
      },
      {
        id: "paid",
        label: "Mark paid",
        handler: async (rows) => {
          const ids = rows.map((r) => r.id)
          const result = await bulkInvoiceAction("mark_paid", ids)
          if (result.ok) {
            const idSet = new Set(ids)
            setInvoices((prev) =>
              prev.map((inv) =>
                idSet.has(inv.id)
                  ? { ...inv, status: "paid" as Invoice["status"], paidAt: new Date().toISOString() }
                  : inv,
              ),
            )
            toast.success(`${rows.length} invoices marked paid`)
          } else {
            toast.error(result.error ?? "Failed to mark invoices paid")
          }
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          downloadCsv(
            ["Invoice", "Customer", "Status", "Total", "Due", "Paid"],
            rows.map((r) => [r.number, r.customerName, r.status, r.total, r.dueAt, r.paidAt ?? ""]),
            `yugo-invoices-${new Date().toISOString().slice(0, 10)}`,
          )
          toast.success(`Downloaded ${rows.length} invoices`)
        },
      },
      {
        id: "void",
        label: "Void",
        destructive: true,
        handler: async (rows) => {
          const ids = rows.map((r) => r.id)
          const result = await bulkInvoiceAction("cancel", ids)
          if (result.ok) {
            const idSet = new Set(ids)
            setInvoices((prev) =>
              prev.map((inv) => idSet.has(inv.id) ? { ...inv, status: "void" as Invoice["status"] } : inv),
            )
            toast.error(`Voided ${rows.length} invoices`)
          } else {
            toast.error(result.error ?? "Failed to void invoices")
          }
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
          <NewInvoiceModal onCreated={(inv) => setInvoices((prev) => [inv, ...prev])} />
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
        onStatusChange={(invoiceId, newStatus) => {
          setInvoices((prev) =>
            prev.map((inv) =>
              inv.id === invoiceId
                ? {
                    ...inv,
                    status: newStatus as Invoice["status"],
                    paidAt:
                      newStatus === "paid"
                        ? new Date().toISOString()
                        : inv.paidAt,
                  }
                : inv,
            ),
          )
        }}
        moves={moves}
      />
    </div>
  )
}

const NewInvoiceModal = ({ onCreated }: { onCreated: (invoice: Invoice) => void }) => {
  const [open, setOpen] = React.useState(false)
  const [clientName, setClientName] = React.useState("")
  const [amount, setAmount] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const reset = () => { setClientName(""); setAmount(""); setDueDate("") }

  const handleCreate = async () => {
    if (!clientName.trim()) { toast.error("Client name is required"); return }
    const amountNum = parseFloat(amount)
    if (!amountNum || amountNum <= 0) { toast.error("Amount must be greater than 0"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          client_name: clientName.trim(),
          amount: amountNum,
          due_date: dueDate || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create invoice")
      } else {
        const raw = data.invoice ?? data
        const newInvoice: Invoice = {
          id: raw.id,
          number: raw.invoice_number ?? raw.number ?? "INV-???",
          customerId: raw.organization_id ?? "",
          customerName: clientName.trim(),
          moveId: raw.move_id ?? null,
          status: "draft",
          subtotal: amountNum,
          tax: 0,
          total: amountNum,
          dueAt: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paidAt: null,
          createdAt: raw.created_at ?? new Date().toISOString(),
        }
        toast.success(`Invoice ${newInvoice.number} created`)
        onCreated(newInvoice)
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
          New invoice
        </Button>
      </ModalTrigger>
      <ModalContent size="sm">
        <ModalHeader title="Create invoice" description="Generate a manual invoice for a client or partner." />
        <div className="space-y-3">
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Client name *</label>
            <Input
              type="text"
              placeholder="Acme Corp or Jane Smith"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Amount *</label>
            <Input
              type="number"
              placeholder="0.00"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="label-sm text-fg-subtle block mb-1">Due date</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary" size="sm">Cancel</Button>
          </ModalClose>
          <Button variant="primary" size="sm" disabled={saving} onClick={handleCreate}>
            {saving ? "Creating…" : "Create invoice"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
