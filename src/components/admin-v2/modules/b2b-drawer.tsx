"use client"

import * as React from "react"
import Link from "next/link"
import { Button } from "../primitives/Button"
import { Chip } from "../primitives/Chip"
import { Icon } from "../primitives/Icon"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { B2BPartner, Move } from "@/lib/admin-v2/mock/types"
import {
  B2B_STATUS_LABEL,
  MOVE_STATUS_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatShortDate,
} from "@/lib/admin-v2/format"

type B2BDrawerProps = {
  partner: B2BPartner | null
  open: boolean
  onOpenChange: (open: boolean) => void
  moves?: Move[]
}

const statusVariant = (status: B2BPartner["status"]) =>
  status === "active"
    ? "success"
    : status === "paused"
      ? "warning"
      : "neutral"

export const B2BDrawer = ({ partner, open, onOpenChange, moves = [] }: B2BDrawerProps) => {
  if (!partner) return null

  const partnerMoves = moves
    .filter((m) => m.organizationId === partner.id)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 10)

  const overview = (
    <DrawerStatGrid
      items={[
        { label: "Vertical", value: VERTICAL_LABEL[partner.vertical] },
        { label: "Primary contact", value: partner.primaryContact },
        {
          label: "Email",
          value: (
            <a href={`mailto:${partner.email}`} className="text-accent hover:underline label-sm">
              {partner.email}
            </a>
          ),
        },
        {
          label: "Phone",
          value: (
            <a href={`tel:${partner.phone}`} className="text-accent hover:underline label-sm">
              {partner.phone}
            </a>
          ),
        },
        {
          label: "Jobs (30d)",
          value: partner.jobsLast30.toString(),
        },
        {
          label: "Revenue (30d)",
          value: formatCurrencyCompact(partner.revenueLast30),
        },
        {
          label: "On-time",
          value: formatPercent(partner.onTimePercent, 1),
        },
        {
          label: "Onboarded",
          value: formatShortDate(partner.createdAt),
        },
      ]}
    />
  )

  const rateCard = (
    <DrawerSection title="Rate card">
      <div className="space-y-2">
        {[
          { label: "Base delivery rate", value: "$180 / job" },
          { label: "Per-additional piece", value: "$20" },
          { label: "Hourly labour", value: "$85" },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2"
          >
            <span className="body-sm text-fg">{row.label}</span>
            <span className="label-md text-fg tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </DrawerSection>
  )

  const jobsTab = partnerMoves.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Job</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Value</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Date</th>
          </tr>
        </thead>
        <tbody>
          {partnerMoves.map((move) => (
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
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed border-line bg-surface-subtle text-center">
      <p className="body-sm font-medium text-fg">No jobs on record</p>
      <p className="mt-1 body-xs text-fg-subtle">Jobs will appear here once linked to this partner.</p>
    </div>
  )

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/admin/clients/${partner.id}`} target="_blank">
          <Icon name="arrowUpRight" size="sm" weight="bold" />
          Open in admin
        </Link>
      </Button>
      <Button variant="primary" size="sm" asChild>
        <Link href={`${ADMIN_V2_BASE}/moves/new`} onClick={() => onOpenChange(false)}>
          New job
        </Link>
      </Button>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={partner.name}
      subtitle={VERTICAL_LABEL[partner.vertical]}
      status={{
        label: B2B_STATUS_LABEL[partner.status],
        variant: statusVariant(partner.status),
      }}
      tabs={[
        { id: "overview", label: "Profile", content: overview },
        { id: "rate", label: "Rate card", content: rateCard },
        { id: "jobs", label: `Jobs (${partnerMoves.length})`, content: jobsTab },
      ]}
      footer={footer}
    />
  )
}
