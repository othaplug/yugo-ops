"use client"

import * as React from "react"
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
import type { Customer } from "@/lib/admin-v2/mock/types"
import {
  CUSTOMER_TYPE_LABEL,
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
}

export const CustomerDrawer = ({
  customer,
  open,
  onOpenChange,
}: CustomerDrawerProps) => {
  if (!customer) return null

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

  const moves = (
    <EmptyTab
      title="Move history"
      description={`${customer.movesCount} past moves. Connect to the Supabase moves table to show details.`}
    />
  )

  const quotes = (
    <EmptyTab
      title="Recent quotes"
      description="Quote history renders here when connected to Supabase."
    />
  )

  const invoices = (
    <EmptyTab
      title="Invoices"
      description="Invoices and payments render here when connected to Supabase."
    />
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
    { id: "moves", label: "Moves", content: moves },
    { id: "quotes", label: "Quotes", content: quotes },
    { id: "invoices", label: "Invoices", content: invoices },
    { id: "communications", label: "Communications", content: communications },
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
