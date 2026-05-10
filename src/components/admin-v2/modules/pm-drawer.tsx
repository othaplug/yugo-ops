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
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { PMAccount, Move } from "@/lib/admin-v2/mock/types"
import {
  MOVE_STATUS_LABEL,
  PM_CONTRACT_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatShortDate,
} from "@/lib/admin-v2/format"

type PMDrawerProps = {
  account: PMAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  moves?: Move[]
}

const contractVariant = (status: PMAccount["contractStatus"]) =>
  status === "active"
    ? "success"
    : status === "renewal"
      ? "warning"
      : "danger"

export const PMDrawer = ({ account, open, onOpenChange, moves = [] }: PMDrawerProps) => {
  if (!account) return null

  const accountMoves = moves
    .filter((m) => m.organizationId === account.id)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 10)

  const overview = (
    <DrawerStatGrid
      items={[
        { label: "Primary contact", value: account.primaryContact },
        { label: "Email", value: account.email },
        { label: "Buildings", value: account.buildings.toString() },
        { label: "Moves (30d)", value: account.movesLast30.toString() },
        {
          label: "Contract",
          value: PM_CONTRACT_LABEL[account.contractStatus],
        },
        { label: "Onboarded", value: formatShortDate(account.createdAt) },
      ]}
    />
  )

  const schedule = (
    <DrawerSection title="Upcoming schedule">
      <div className="space-y-2">
        {[
          { label: "Full move", count: 4 },
          { label: "Common area delivery", count: 2 },
          { label: "Inter-unit transfer", count: 1 },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-md border border-line bg-surface-subtle px-3 py-2"
          >
            <span className="body-sm text-fg">{row.label}</span>
            <span className="label-md text-fg tabular-nums">{row.count}</span>
          </div>
        ))}
      </div>
    </DrawerSection>
  )

  const movesTab = accountMoves.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Move</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Value</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Date</th>
          </tr>
        </thead>
        <tbody>
          {accountMoves.map((move) => (
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
      <p className="body-sm font-medium text-fg">No moves on record</p>
      <p className="mt-1 body-xs text-fg-subtle">Moves will appear here once linked to this account.</p>
    </div>
  )

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/admin/partners/${account.id}/billing`} target="_blank">
          <Icon name="arrowUpRight" size="sm" weight="bold" />
          Billing
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          asChild
        >
          <Link href={`/admin/partners/health`} target="_blank">
            Health
          </Link>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => toast.info("New project flow opens here")}
        >
          New project
        </Button>
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={account.name}
      subtitle={account.primaryContact}
      status={{
        label: PM_CONTRACT_LABEL[account.contractStatus],
        variant: contractVariant(account.contractStatus),
      }}
      tabs={[
        { id: "overview", label: "Profile", content: overview },
        { id: "schedule", label: "Schedule", content: schedule },
        { id: "moves", label: `Moves (${accountMoves.length})`, content: movesTab },
      ]}
      footer={footer}
    />
  )
}
