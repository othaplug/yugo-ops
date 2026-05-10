"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip, variantForStatus } from "../primitives/Chip"
import {
  DrawerSection,
  DrawerStatGrid,
  DrawerTimeline,
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { Customer, Move, Quote, Invoice } from "@/lib/admin-v2/mock/types"
import {
  CUSTOMER_TYPE_LABEL,
  INVOICE_STATUS_LABEL,
  MOVE_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatRelativeDays,
  formatShortDate,
} from "@/lib/admin-v2/format"

type CustomerDrawerProps = {
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  moves?: Move[]
  quotes?: Quote[]
  invoices?: Invoice[]
}

export const CustomerDrawer = ({
  customer,
  open,
  onOpenChange,
  moves = [],
  quotes = [],
  invoices = [],
}: CustomerDrawerProps) => {
  if (!customer) return null

  const customerMoves = moves.filter((m) => m.customerId === customer.id)
  const customerQuotes = quotes.filter((q) => q.customerId === customer.id)
  const customerInvoices = invoices.filter((i) => i.customerId === customer.id)

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Type", value: CUSTOMER_TYPE_LABEL[customer.type] },
          {
            label: "Vertical",
            value: customer.vertical ? VERTICAL_LABEL[customer.vertical] : "Residential",
          },
          { label: "Lifetime value", value: formatCurrency(customer.ltv) },
          { label: "Moves", value: customer.movesCount.toString() },
          {
            label: "Last contact",
            value: formatRelativeDays(customer.lastContactAt),
          },
          {
            label: "Customer since",
            value: formatShortDate(customer.createdAt),
          },
        ]}
      />

      <DrawerSection title="Contact">
        <div className="space-y-2">
          <ContactRow icon="email" label={customer.email} />
          <ContactRow icon="phone" label={customer.phone} />
        </div>
      </DrawerSection>

      {customer.tags.length ? (
        <DrawerSection title="Tags">
          <div className="flex flex-wrap gap-2">
            {customer.tags.map((tag) => (
              <Chip key={tag} label={tag} variant="brand" />
            ))}
          </div>
        </DrawerSection>
      ) : null}
    </div>
  )

  const movesTab = customerMoves.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Move</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Total</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Date</th>
          </tr>
        </thead>
        <tbody>
          {customerMoves.map((move) => (
            <tr key={move.id} className="border-t border-line hover:bg-surface-subtle transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`${ADMIN_V2_BASE}/moves?drawer=move:${move.id}`}
                  className="text-fg font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {move.number}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Chip
                  label={MOVE_STATUS_LABEL[move.status]}
                  variant={
                    move.status === "completed"
                      ? "success"
                      : move.status === "in-transit" || move.status === "pre-move"
                        ? "info"
                        : move.status === "cancelled"
                          ? "danger"
                          : "neutral"
                  }
                />
              </td>
              <td className="px-3 py-2 text-right text-fg tabular-nums">
                {formatCurrency(move.total)}
              </td>
              <td className="px-3 py-2 text-right text-fg-subtle">
                {formatShortDate(move.scheduledAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyTab title="No moves" description="This customer has no moves on record yet." />
  )

  const quotesTab = customerQuotes.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Quote</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Total</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Expires</th>
          </tr>
        </thead>
        <tbody>
          {customerQuotes.map((quote) => (
            <tr key={quote.id} className="border-t border-line hover:bg-surface-subtle transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`${ADMIN_V2_BASE}/quotes?drawer=quote:${quote.id}`}
                  className="text-fg font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {quote.number}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Chip
                  label={QUOTE_STATUS_LABEL[quote.status]}
                  variant={variantForStatus(quote.status)}
                />
              </td>
              <td className="px-3 py-2 text-right text-fg tabular-nums">
                {formatCurrency(quote.total)}
              </td>
              <td className="px-3 py-2 text-right text-fg-subtle">
                {formatShortDate(quote.expiresAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyTab title="No quotes" description="This customer has no quotes on record yet." />
  )

  const invoicesTab = customerInvoices.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Invoice</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Total</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Due</th>
          </tr>
        </thead>
        <tbody>
          {customerInvoices.map((inv) => (
            <tr key={inv.id} className="border-t border-line hover:bg-surface-subtle transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`${ADMIN_V2_BASE}/invoices?drawer=invoice:${inv.id}`}
                  className="text-fg font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {inv.number}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Chip
                  label={INVOICE_STATUS_LABEL[inv.status]}
                  variant={
                    inv.status === "paid"
                      ? "success"
                      : inv.status === "overdue"
                        ? "danger"
                        : inv.status === "sent"
                          ? "info"
                          : "neutral"
                  }
                />
              </td>
              <td className="px-3 py-2 text-right text-fg tabular-nums">
                {formatCurrency(inv.total)}
              </td>
              <td className="px-3 py-2 text-right text-fg-subtle">
                {formatShortDate(inv.dueAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyTab title="No invoices" description="This customer has no invoices on record yet." />
  )

  const communications = (
    <DrawerTimeline
      events={[
        {
          id: "last",
          label: "Last outreach",
          at: formatShortDate(customer.lastContactAt),
        },
        {
          id: "created",
          label: "Account created",
          at: formatShortDate(customer.createdAt),
        },
      ]}
    />
  )

  const tabs = [
    { id: "overview", label: "Overview", content: overview },
    { id: "moves", label: `Moves (${customerMoves.length})`, content: movesTab },
    { id: "quotes", label: `Quotes (${customerQuotes.length})`, content: quotesTab },
    { id: "invoices", label: `Invoices (${customerInvoices.length})`, content: invoicesTab },
    { id: "communications", label: "Activity", content: communications },
  ]

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Icon name="message" size="sm" />}
        onClick={() => toast.message(`Message ${customer.name}`)}
      >
        Message
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.info(`Quote for ${customer.name}`)}
        >
          Create quote
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => toast.success(`Move scheduled for ${customer.name}`)}
        >
          Create move
        </Button>
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={customer.name}
      subtitle={customer.email}
      status={{
        label: CUSTOMER_TYPE_LABEL[customer.type],
        variant: variantForStatus(customer.type),
      }}
      tabs={tabs}
      footer={footer}
    />
  )
}

const ContactRow = ({
  icon,
  label,
}: {
  icon: "email" | "phone"
  label: string
}) => (
  <div className="flex items-center gap-2 body-sm text-fg">
    <Icon name={icon} size="sm" className="text-fg-subtle" />
    <span>{label}</span>
  </div>
)

const EmptyTab = ({
  title,
  description,
}: {
  title: string
  description: string
}) => (
  <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed border-line bg-surface-subtle text-center">
    <p className="body-sm font-medium text-fg">{title}</p>
    <p className="mt-1 body-xs text-fg-subtle">{description}</p>
  </div>
)
