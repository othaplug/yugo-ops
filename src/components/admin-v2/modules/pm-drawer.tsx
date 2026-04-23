"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import type { PMAccount } from "@/lib/admin-v2/mock/types"
import { PM_CONTRACT_LABEL } from "@/lib/admin-v2/labels"
import { formatShortDate } from "@/lib/admin-v2/format"

type PMDrawerProps = {
  account: PMAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const contractVariant = (status: PMAccount["contractStatus"]) =>
  status === "active"
    ? "success"
    : status === "renewal"
      ? "warning"
      : "danger"

export const PMDrawer = ({ account, open, onOpenChange }: PMDrawerProps) => {
  if (!account) return null

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

  const footer = (
    <div className="flex w-full items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.info("Statement generation queued")}
      >
        Generate statement
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => toast.success("New project created")}
      >
        New project
      </Button>
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
      ]}
      footer={footer}
    />
  )
}
