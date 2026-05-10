"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip } from "../primitives/Chip"
import { Sparkline } from "../composites/Sparkline"
import { IndicatorBars } from "../composites/IndicatorBars"
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "../primitives/Dropdown"
import {
  DrawerSection,
  DrawerStatGrid,
  DrawerTimeline,
  ModuleDrawer,
} from "./module-drawer"
import { variantForStatus } from "../primitives/Chip"
import type { Lead } from "@/lib/admin-v2/mock/types"
import {
  LEAD_PROBABILITY_LABEL,
  LEAD_STATUS_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatRelativeDays,
  formatShortDate,
} from "@/lib/admin-v2/format"
import { downloadCsv } from "@/lib/admin-v2/csv"

type LeadDrawerProps = {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConvert?: (lead: Lead) => void
  onMarkLost?: (lead: Lead) => void
  onStatusChange?: (leadId: string, newStatus: string) => void
}

async function patchLeadStatus(leadId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
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

export const LeadDrawer = ({
  lead,
  open,
  onOpenChange,
  onConvert,
  onMarkLost,
  onStatusChange,
}: LeadDrawerProps) => {
  const [loading, setLoading] = React.useState<string | null>(null)
  const router = useRouter()
  if (!lead) return null

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Source", value: <Chip label={lead.source} variant="neutral" /> },
          { label: "Size", value: formatCurrency(lead.size) },
          {
            label: "Probability",
            value: <IndicatorBars level={lead.probability} label={LEAD_PROBABILITY_LABEL[lead.probability]} />,
          },
          {
            label: "Last contact",
            value: formatRelativeDays(lead.lastAction),
          },
        ]}
      />

      <DrawerSection title="Interest signal">
        <div className="flex items-end justify-between rounded-md border border-line bg-surface-subtle px-4 py-3">
          <div>
            <p className="label-sm text-fg-subtle">7-day engagement</p>
            <p className="mt-1 display-sm text-fg tabular-nums">
              {Math.round(lead.interest[lead.interest.length - 1] ?? 0)}
            </p>
          </div>
          <Sparkline data={lead.interest} width={160} height={40} strokeWidth={2} />
        </div>
      </DrawerSection>

      <DrawerSection title="Contact">
        <dl className="space-y-2">
          <ContactRow icon="email" label={lead.email} />
          <ContactRow icon="phone" label={lead.phone} />
        </dl>
      </DrawerSection>

      <DrawerSection title="Ownership">
        <p className="body-sm text-fg">Assigned to {lead.ownerName}</p>
        <p className="body-xs text-fg-subtle">
          Created {formatShortDate(lead.createdAt)}
        </p>
      </DrawerSection>
    </div>
  )

  const activity = (
    <DrawerTimeline
      events={[
        {
          id: "last",
          label: `Last touch logged by ${lead.ownerName}`,
          at: formatShortDate(lead.lastAction),
        },
        {
          id: "stage",
          label: `Stage changed to ${LEAD_STATUS_LABEL[lead.status]}`,
          at: formatShortDate(lead.lastAction),
          actor: lead.ownerName,
        },
        {
          id: "created",
          label: `Lead captured from ${lead.source}`,
          at: formatShortDate(lead.createdAt),
        },
      ]}
    />
  )

  const quotes = (
    <EmptyTab
      title="No quotes yet"
      description="Convert this lead to generate the first quote."
    />
  )

  const notes = (
    <div className="space-y-3">
      <textarea
        className="h-40 w-full resize-none rounded-md border border-line bg-surface px-3 py-2 body-sm text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        placeholder={`Notes for ${lead.name}...`}
        defaultValue=""
      />
      <p className="body-xs text-fg-subtle">
        Notes are private to the ops team and never surface on the client quote.
      </p>
    </div>
  )

  const footer = (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href={`/admin/leads/${lead.id}`} target="_blank">
            <Icon name="arrowUpRight" size="sm" weight="bold" />
            Open
          </Link>
        </Button>
        <Button variant="secondary" size="sm" leadingIcon={<Icon name="email" size="sm" />} asChild>
          <a href={`mailto:${lead.email}`}>Email</a>
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <DropdownRoot>
          <DropdownTrigger asChild>
            <Button variant="ghost" size="iconSm" aria-label="More">
              <Icon name="more" size="md" />
            </Button>
          </DropdownTrigger>
          <DropdownContent align="end">
            <DropdownItem
              onSelect={async () => {
                setLoading("lost")
                const result = await patchLeadStatus(lead.id, "disqualified")
                setLoading(null)
                if (result.ok) {
                  toast.error(`${lead.name} marked lost`)
                  onMarkLost?.(lead)
                  onStatusChange?.(lead.id, "lost")
                } else {
                  toast.error(result.error ?? "Failed to update lead")
                }
              }}
            >
              {loading === "lost" ? "Saving…" : "Mark lost"}
            </DropdownItem>
            <DropdownItem
              onSelect={() => {
                downloadCsv(
                  ["Name", "Email", "Phone", "Source", "Status", "Size", "Owner", "Last contact"],
                  [[lead.name, lead.email, lead.phone, lead.source, lead.status, lead.size, lead.ownerName, lead.lastAction]],
                  `yugo-lead-${lead.name.replace(/\s+/g, "-").toLowerCase()}`,
                )
              }}
            >
              Export
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem
              destructive
              onSelect={() => toast.error(`${lead.name} deleted`)}
            >
              Delete lead
            </DropdownItem>
          </DropdownContent>
        </DropdownRoot>
        <Button
          variant="primary"
          size="sm"
          disabled={loading !== null}
          onClick={() => {
            onConvert?.(lead)
            onOpenChange(false)
            router.push("/admin-v2/quotes/new")
          }}
        >
          Convert to quote
        </Button>
      </div>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={lead.name}
      subtitle={lead.email}
      status={{
        label: LEAD_STATUS_LABEL[lead.status],
        variant: variantForStatus(lead.status),
      }}
      tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "activity", label: "Activity", content: activity },
        { id: "quotes", label: "Quotes", content: quotes },
        { id: "notes", label: "Notes", content: notes },
      ]}
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
  <a
    href={icon === "email" ? `mailto:${label}` : `tel:${label}`}
    className="flex items-center gap-2 body-sm text-fg hover:text-accent transition-colors"
  >
    <Icon name={icon} size="sm" className="text-fg-subtle" />
    <span>{label}</span>
  </a>
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
