"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { variantForStatus } from "../primitives/Chip"
import {
  DrawerSection,
  DrawerStatGrid,
  DrawerTimeline,
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { Quote } from "@/lib/admin-v2/mock/types"
import {
  QUOTE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  TIER_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatRelativeDays,
  formatShortDate,
} from "@/lib/admin-v2/format"

type QuoteDrawerProps = {
  quote: Quote | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange?: (quoteId: string, newStatus: string) => void
}

async function patchQuoteStatus(
  quoteId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/quotes/${quoteId}`, {
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

async function resendQuote(quoteId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/admin/quotes/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "resend", ids: [quoteId] }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

export const QuoteDrawer = ({
  quote,
  open,
  onOpenChange,
  onStatusChange,
}: QuoteDrawerProps) => {
  const [loading, setLoading] = React.useState<string | null>(null)

  const handleAction = React.useCallback(
    async (
      action: "won" | "resend" | "duplicate",
    ) => {
      if (!quote) return
      setLoading(action)

      if (action === "won") {
        const result = await patchQuoteStatus(quote.id, "accepted")
        setLoading(null)
        if (result.ok) {
          toast.success(`${quote.number} marked as won`)
          onStatusChange?.(quote.id, "accepted")
        } else {
          toast.error(result.error ?? "Failed to update quote")
        }
      } else if (action === "resend") {
        const result = await resendQuote(quote.id)
        setLoading(null)
        if (result.ok) {
          toast.success(`${quote.number} resent`)
          onStatusChange?.(quote.id, "sent")
        } else {
          toast.error(result.error ?? "Failed to resend quote")
        }
      } else {
        setLoading(null)
        toast.info("Duplicate quote")
      }
    },
    [quote, onStatusChange],
  )

  if (!quote) return null

  const isTerminal =
    quote.status === "accepted" ||
    quote.status === "declined" ||
    quote.status === "expired"

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          {
            label: "Customer",
            value: (
              <Link
                href={`${ADMIN_V2_BASE}/customers?drawer=customer:${quote.customerId}`}
                className="text-accent hover:underline label-sm"
                onClick={() => onOpenChange(false)}
              >
                {quote.customerName}
              </Link>
            ),
          },
          { label: "Service", value: SERVICE_TYPE_LABEL[quote.serviceType] },
          { label: "Tier", value: TIER_LABEL[quote.tier] },
          { label: "Total", value: formatCurrency(quote.total) },
          { label: "Sent", value: quote.sentAt ? formatRelativeDays(quote.sentAt) : "Not sent" },
          { label: "Expires", value: formatShortDate(quote.expiresAt) },
        ]}
      />

      <DrawerSection title="Client link">
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2">
          <span className="body-sm truncate text-fg">
            yugomoving.com/quote/{quote.number.toLowerCase()}
          </span>
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<Icon name="copy" size="sm" />}
            onClick={() => {
              const url = `https://yugomoving.com/quote/${quote.number.toLowerCase()}`
              navigator.clipboard.writeText(url).then(
                () => toast.success("Quote link copied"),
                () => toast.error("Failed to copy"),
              )
            }}
          >
            Copy
          </Button>
        </div>
      </DrawerSection>
    </div>
  )

  const lineItems = (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="label-sm text-fg-subtle px-3 py-2 text-left">Item</th>
            <th className="label-sm text-fg-subtle px-3 py-2 text-right">Qty</th>
            <th className="label-sm text-fg-subtle px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[
            { label: `${TIER_LABEL[quote.tier]} package`, qty: 1, value: Math.round(quote.total * 0.62) },
            { label: "Labour", qty: 6, value: Math.round(quote.total * 0.24) },
            { label: "Truck fee", qty: 1, value: Math.round(quote.total * 0.08) },
            { label: "Tax", qty: 1, value: Math.round(quote.total * 0.06) },
          ].map((item) => (
            <tr key={item.label}>
              <td className="px-3 py-2 body-sm text-fg">{item.label}</td>
              <td className="px-3 py-2 body-sm text-fg-muted tabular-nums text-right">
                {item.qty}
              </td>
              <td className="px-3 py-2 body-sm text-fg tabular-nums text-right">
                {formatCurrency(item.value)}
              </td>
            </tr>
          ))}
          <tr className="bg-surface-subtle">
            <td className="px-3 py-2 label-md text-fg-subtle">Total</td>
            <td />
            <td className="px-3 py-2 body-sm font-semibold text-fg tabular-nums text-right">
              {formatCurrency(quote.total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )

  const activity = (
    <DrawerTimeline
      events={[
        quote.viewedAt
          ? { id: "viewed", label: "Client viewed quote", at: formatShortDate(quote.viewedAt) }
          : null,
        quote.sentAt
          ? { id: "sent", label: "Quote sent", at: formatShortDate(quote.sentAt) }
          : null,
        { id: "created", label: "Quote created", at: formatShortDate(quote.createdAt) },
      ].filter(Boolean) as Array<{ id: string; label: string; at: string }>}
    />
  )

  const preview = (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-md border border-dashed border-line bg-surface-subtle">
      <div className="text-center">
        <p className="body-sm font-medium text-fg">Client-facing preview</p>
        <p className="mt-1 body-xs text-fg-subtle">
          Premium quote page renders the full Estate or Signature shell here.
        </p>
      </div>
    </div>
  )

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={loading !== null}
        onClick={() => handleAction("duplicate")}
      >
        Duplicate
      </Button>
      <div className="flex items-center gap-2">
        {!isTerminal && (
          <Button
            variant="secondary"
            size="sm"
            disabled={loading !== null}
            onClick={() => handleAction("resend")}
          >
            {loading === "resend" ? "Resending…" : "Resend"}
          </Button>
        )}
        {quote.status !== "accepted" && (
          <Button
            variant="primary"
            size="sm"
            disabled={loading !== null || isTerminal}
            onClick={() => handleAction("won")}
          >
            {loading === "won" ? "Saving…" : "Mark as won"}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={quote.number}
      subtitle={`${quote.customerName} · ${TIER_LABEL[quote.tier]}`}
      status={{
        label: QUOTE_STATUS_LABEL[quote.status],
        variant: variantForStatus(quote.status),
      }}
      tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "line-items", label: "Line items", content: lineItems },
        { id: "activity", label: "Activity", content: activity },
        { id: "preview", label: "Preview", content: preview },
      ]}
      footer={footer}
    />
  )
}
