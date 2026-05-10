"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip } from "../primitives/Chip"
import {
  DrawerSection,
  DrawerStatGrid,
  DrawerTimeline,
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { Invoice, Move } from "@/lib/admin-v2/mock/types"
import { INVOICE_STATUS_LABEL } from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatShortDate,
} from "@/lib/admin-v2/format"

type InvoiceDrawerProps = {
  invoice: Invoice | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (invoiceId: string, newStatus: string) => void
  moves?: Move[]
}

const statusVariant = (status: Invoice["status"]) => {
  switch (status) {
    case "paid":
      return "success" as const
    case "overdue":
      return "danger" as const
    case "sent":
      return "info" as const
    case "draft":
      return "neutral" as const
    case "void":
    case "refunded":
      return "neutral" as const
    default:
      return "neutral" as const
  }
}

async function patchInvoiceStatus(invoiceId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

export const InvoiceDrawer = ({
  invoice,
  open,
  onOpenChange,
  onStatusChange,
  moves = [],
}: InvoiceDrawerProps) => {
  const [loading, setLoading] = React.useState<string | null>(null)

  const handleStatusChange = React.useCallback(
    async (newStatus: string, label: string) => {
      if (!invoice) return
      setLoading(newStatus)
      const result = await patchInvoiceStatus(invoice.id, newStatus)
      setLoading(null)
      if (result.ok) {
        toast.success(`Invoice ${label}`)
        onStatusChange?.(invoice.id, newStatus)
      } else {
        toast.error(result.error ?? "Failed to update invoice")
      }
    },
    [invoice, onStatusChange],
  )

  if (!invoice) return null

  const linkedMove = invoice.moveId ? moves.find((m) => m.id === invoice.moveId) ?? null : null

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Customer", value: invoice.customerName },
          {
            label: "Linked move",
            value: linkedMove ? (
              <Link
                href={`${ADMIN_V2_BASE}/moves?drawer=move:${linkedMove.id}`}
                className="text-accent hover:underline label-sm"
                onClick={() => onOpenChange(false)}
              >
                {linkedMove.number}
              </Link>
            ) : invoice.moveId ? "–" : "None",
          },
          {
            label: "Subtotal",
            value: formatCurrency(invoice.subtotal),
          },
          {
            label: "Tax",
            value: formatCurrency(invoice.tax),
          },
          {
            label: "Total",
            value: formatCurrency(invoice.total),
          },
          { label: "Due", value: formatShortDate(invoice.dueAt) },
          {
            label: "Paid",
            value: invoice.paidAt ? formatShortDate(invoice.paidAt) : "–",
          },
          {
            label: "Status",
            value: (
              <Chip
                label={INVOICE_STATUS_LABEL[invoice.status]}
                variant={statusVariant(invoice.status)}
              />
            ),
          },
        ]}
      />
    </div>
  )

  const lineItems = (
    <DrawerSection title="Line items">
      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full body-sm">
          <thead className="bg-surface-subtle">
            <tr>
              <th className="px-3 py-2 text-left label-sm text-fg-subtle">Item</th>
              <th className="px-3 py-2 text-right label-sm text-fg-subtle">Qty</th>
              <th className="px-3 py-2 text-right label-sm text-fg-subtle">Rate</th>
              <th className="px-3 py-2 text-right label-sm text-fg-subtle">Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              { item: "Base move rate", qty: 1, rate: invoice.subtotal * 0.6 },
              { item: "Labour", qty: 1, rate: invoice.subtotal * 0.3 },
              { item: "Materials & supplies", qty: 1, rate: invoice.subtotal * 0.1 },
            ].map((row) => (
              <tr key={row.item} className="border-t border-line">
                <td className="px-3 py-2 text-fg">{row.item}</td>
                <td className="px-3 py-2 text-right text-fg tabular-nums">{row.qty}</td>
                <td className="px-3 py-2 text-right text-fg tabular-nums">{formatCurrency(row.rate)}</td>
                <td className="px-3 py-2 text-right text-fg tabular-nums font-medium">
                  {formatCurrency(row.qty * row.rate)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line bg-surface-subtle">
              <td className="px-3 py-2 label-sm text-fg-subtle" colSpan={3}>Tax</td>
              <td className="px-3 py-2 text-right text-fg tabular-nums">{formatCurrency(invoice.tax)}</td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-3 py-2 label-md text-fg" colSpan={3}>Total</td>
              <td className="px-3 py-2 text-right text-fg tabular-nums font-semibold">
                {formatCurrency(invoice.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </DrawerSection>
  )

  const activity = (
    <DrawerTimeline
      events={[
        {
          id: "created",
          label: "Invoice created",
          at: formatShortDate(invoice.createdAt),
        },
        invoice.status !== "draft"
          ? { id: "sent", label: "Sent", at: formatShortDate(invoice.createdAt) }
          : null,
        invoice.paidAt
          ? { id: "paid", label: "Payment received", at: formatShortDate(invoice.paidAt) }
          : null,
      ].filter(Boolean) as Array<{ id: string; label: string; at: string }>}
    />
  )

  const isPaid = invoice.status === "paid"
  const isVoid = invoice.status === "void" || invoice.status === "refunded"

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`${ADMIN_V2_BASE}/invoices?drawer=invoice:${invoice.id}`}>
          <Icon name="arrowUpRight" size="sm" weight="bold" />
          Open
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        {!isVoid && !isPaid && (
          <Button
            variant="secondary"
            size="sm"
            disabled={loading !== null}
            onClick={() => handleStatusChange("void", "voided")}
          >
            {loading === "void" ? "Voiding…" : "Void"}
          </Button>
        )}
        {!isPaid && !isVoid && (
          <Button
            variant="secondary"
            size="sm"
            disabled={loading !== null}
            onClick={() => handleStatusChange("paid", "marked paid")}
          >
            {loading === "paid" ? "Saving…" : "Mark paid"}
          </Button>
        )}
        {invoice.status === "draft" && (
          <Button
            variant="primary"
            size="sm"
            disabled={loading !== null}
            onClick={() => handleStatusChange("sent", "sent")}
          >
            {loading === "sent" ? "Sending…" : "Send"}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={invoice.number}
      subtitle={invoice.customerName}
      status={{
        label: INVOICE_STATUS_LABEL[invoice.status],
        variant: statusVariant(invoice.status),
      }}
      tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "line-items", label: "Line items", content: lineItems },
        { id: "activity", label: "Activity", content: activity },
      ]}
      footer={footer}
    />
  )
}
