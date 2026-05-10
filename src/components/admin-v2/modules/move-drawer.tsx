"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip, variantForStatus } from "../primitives/Chip"
import { AvatarStack } from "../primitives/AvatarStack"
import {
  DrawerSection,
  DrawerStatGrid,
  DrawerTimeline,
  ModuleDrawer,
} from "./module-drawer"
import type { Move, Invoice } from "@/lib/admin-v2/mock/types"
import {
  INVOICE_STATUS_LABEL,
  MOVE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  TIER_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/admin-v2/format"

type MoveDrawerProps = {
  move: Move | null
  open: boolean
  onOpenChange: (open: boolean) => void
  invoices?: Invoice[]
  onStatusChange?: (moveId: string, newStatus: string) => void
}

async function patchMoveStatus(moveId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/moves/${moveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "update_status", status }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

export const MoveDrawer = ({ move, open, onOpenChange, invoices = [], onStatusChange }: MoveDrawerProps) => {
  const [loading, setLoading] = React.useState<string | null>(null)
  if (!move) return null

  const linkedInvoice = invoices.find((inv) => inv.moveId === move.id) ?? null

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Customer", value: move.customerName },
          { label: "Service", value: SERVICE_TYPE_LABEL[move.serviceType] },
          { label: "Tier", value: TIER_LABEL[move.tier] },
          { label: "Total", value: formatCurrency(move.total) },
          {
            label: "Scheduled",
            value: `${formatShortDate(move.scheduledAt)} · ${formatTimeOfDay(move.scheduledAt)}`,
          },
          {
            label: "Truck",
            value: move.truck ?? "Unassigned",
          },
        ]}
      />

      <DrawerSection title="Route">
        <div className="space-y-3">
          <RouteLine label="Pickup" value={move.origin} />
          <RouteLine label="Dropoff" value={move.destination} />
        </div>
        <div className="mt-4 flex h-40 items-center justify-center rounded-md border border-dashed border-line bg-surface-subtle body-xs text-fg-subtle">
          Mapbox route preview
        </div>
      </DrawerSection>

      <DrawerSection title="Crew">
        <div className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2">
          <AvatarStack
            items={move.crew.map((c) => ({ name: c.name }))}
            max={3}
            size="sm"
          />
          <span className="body-sm text-fg">
            {move.crew.length} assigned
          </span>
        </div>
      </DrawerSection>

      {linkedInvoice ? (
        <DrawerSection title="Invoice">
          <div className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="label-md text-fg">{linkedInvoice.number}</span>
              <Chip
                label={INVOICE_STATUS_LABEL[linkedInvoice.status]}
                variant={
                  linkedInvoice.status === "paid"
                    ? "success"
                    : linkedInvoice.status === "overdue"
                      ? "danger"
                      : linkedInvoice.status === "sent"
                        ? "info"
                        : "neutral"
                }
              />
            </div>
            <span className="body-sm text-fg tabular-nums">
              {formatCurrency(linkedInvoice.total)}
            </span>
          </div>
        </DrawerSection>
      ) : null}
    </div>
  )

  const inventory = (
    <div className="space-y-2">
      {["Living room · 12 items", "Bedroom · 8 items", "Kitchen · 24 items", "Storage · 5 items"].map(
        (line) => (
          <div
            key={line}
            className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2"
          >
            <span className="body-sm text-fg">{line}</span>
            <Button variant="ghost" size="iconSm" aria-label="Edit inventory">
              <Icon name="edit" size="sm" />
            </Button>
          </div>
        ),
      )}
    </div>
  )

  const crew = (
    <ul className="divide-y divide-line rounded-md border border-line">
      {move.crew.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between px-3 py-2"
        >
          <span className="body-sm text-fg">{c.name}</span>
          <span className="label-sm text-fg-subtle uppercase tracking-[0.08em]">
            Crew
          </span>
        </li>
      ))}
    </ul>
  )

  const activity = (
    <DrawerTimeline
      events={[
        {
          id: "scheduled",
          label: `Scheduled for ${formatShortDate(move.scheduledAt)}`,
          at: formatShortDate(move.scheduledAt),
        },
        {
          id: "status",
          label: `Status ${MOVE_STATUS_LABEL[move.status]}`,
          at: formatShortDate(move.scheduledAt),
        },
      ]}
    />
  )

  const moveSlug = move.number.replace(/^#/, "").trim()

  const isTerminal = move.status === "completed" || move.status === "cancelled"
  const isDispatched = move.status === "in-transit" || move.status === "pre-move"

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/admin/moves/${moveSlug}`} target="_blank">
          <Icon name="arrowUpRight" size="sm" weight="bold" />
          Open in admin
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={loading !== null || isTerminal}
          onClick={() => toast.info(`Reschedule ${move.number}`)}
        >
          Reschedule
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={loading !== null || isTerminal || isDispatched}
          onClick={async () => {
            setLoading("dispatch")
            const result = await patchMoveStatus(move.id, "in-transit")
            setLoading(null)
            if (result.ok) {
              toast.success(`${move.number} dispatched`)
              onStatusChange?.(move.id, "in-transit")
            } else {
              toast.error(result.error ?? "Failed to dispatch move")
            }
          }}
        >
          {loading === "dispatch" ? "Dispatching…" : isDispatched ? "Dispatched" : "Dispatch"}
        </Button>
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={move.number}
      subtitle={`${move.customerName} · ${TIER_LABEL[move.tier]}`}
      status={{
        label: MOVE_STATUS_LABEL[move.status],
        variant: variantForStatus(move.status),
      }}
      tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "inventory", label: "Inventory", content: inventory },
        { id: "crew", label: "Crew", content: crew },
        { id: "activity", label: "Activity", content: activity },
      ]}
      footer={footer}
    />
  )
}

const RouteLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <span className="label-sm text-fg-subtle uppercase tracking-[0.08em] mt-0.5 w-16 shrink-0">
      {label}
    </span>
    <span className="body-sm text-fg min-w-0 flex-1">{value}</span>
  </div>
)
