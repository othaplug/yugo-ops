"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Chip } from "../primitives/Chip"
import { Icon } from "../primitives/Icon"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import type { B2BPartner } from "@/lib/admin-v2/mock/types"
import {
  B2B_STATUS_LABEL,
  VERTICAL_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrencyCompact,
  formatPercent,
  formatShortDate,
} from "@/lib/admin-v2/format"

type B2BDrawerProps = {
  partner: B2BPartner | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusVariant = (status: B2BPartner["status"]) =>
  status === "active"
    ? "success"
    : status === "paused"
      ? "warning"
      : "neutral"

export const B2BDrawer = ({ partner, open, onOpenChange }: B2BDrawerProps) => {
  if (!partner) return null

  const overview = (
    <DrawerStatGrid
      items={[
        { label: "Vertical", value: VERTICAL_LABEL[partner.vertical] },
        { label: "Primary contact", value: partner.primaryContact },
        { label: "Email", value: partner.email },
        { label: "Phone", value: partner.phone },
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

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <Button variant="secondary" size="sm" asChild>
        <Link href={`/admin/partners/${partner.id}`} target="_blank">
          <Icon name="arrowUpRight" size="sm" weight="bold" />
          Open in admin
        </Link>
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => toast.info("New job routing opens here")}
      >
        New job
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
      ]}
      footer={footer}
    />
  )
}
