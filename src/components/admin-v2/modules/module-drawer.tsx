"use client"

import * as React from "react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTabs,
} from "../layout/Drawer"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../primitives/Tabs"
import { Chip, type ChipVariant } from "../primitives/Chip"
import { cn } from "../lib/cn"

export type ModuleDrawerTab = {
  id: string
  label: string
  content: React.ReactNode
}

export type ModuleDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  status?: { label: string; variant: ChipVariant }
  meta?: React.ReactNode
  tabs: ModuleDrawerTab[]
  defaultTabId?: string
  footer: React.ReactNode
  widthClass?: string
}

// Thin wrapper that standardizes every record drawer across modules:
// sticky title + status chip, tab row, scrollable body per tab, sticky
// footer with primary/secondary actions. Each module provides its tab
// contents but never repeats the chrome.
export const ModuleDrawer = ({
  open,
  onOpenChange,
  title,
  subtitle,
  status,
  meta,
  tabs,
  defaultTabId,
  footer,
  widthClass,
}: ModuleDrawerProps) => {
  const [tab, setTab] = React.useState(defaultTabId ?? tabs[0]?.id ?? "")
  React.useEffect(() => {
    if (!open) return
    setTab((prev) => {
      if (prev && tabs.some((t) => t.id === prev)) return prev
      return defaultTabId ?? tabs[0]?.id ?? ""
    })
  }, [open, defaultTabId, tabs])

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent widthClass={widthClass}>
        <DrawerHeader
          title={
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{title}</span>
              {status ? (
                <Chip label={status.label} variant={status.variant} />
              ) : null}
            </span>
          }
          description={subtitle}
        />
        {meta ? (
          <div className="border-b border-line px-5 py-3">{meta}</div>
        ) : null}
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DrawerTabs>
            <TabsList className="h-11 gap-5 border-0 p-0">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </DrawerTabs>
          {tabs.map((t) => (
            <TabsContent
              key={t.id}
              value={t.id}
              className="min-h-0 flex-1 data-[state=inactive]:hidden"
              forceMount
            >
              <DrawerBody>{t.content}</DrawerBody>
            </TabsContent>
          ))}
        </Tabs>
        <DrawerFooter>{footer}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export const DrawerStatGrid = ({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode }>
  className?: string
}) => (
  <dl
    className={cn(
      "grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-line bg-surface-subtle px-4 py-3",
      className,
    )}
  >
    {items.map((item) => (
      <div key={item.label} className="flex flex-col gap-0.5">
        <dt className="label-sm text-fg-subtle">{item.label}</dt>
        <dd className="body-sm text-fg font-medium tabular-nums">{item.value}</dd>
      </div>
    ))}
  </dl>
)

export const DrawerSection = ({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) => (
  <section className={cn("flex flex-col gap-3", className)}>
    <header className="flex items-center justify-between gap-3">
      <h3 className="label-md text-fg-subtle uppercase tracking-[0.08em]">
        {title}
      </h3>
      {action}
    </header>
    {children}
  </section>
)

export const DrawerTimeline = ({
  events,
}: {
  events: Array<{ id: string; label: string; at: string; actor?: string }>
}) => (
  <ol className="relative ml-2 space-y-4 border-l border-line pl-5">
    {events.map((event) => (
      <li key={event.id} className="relative">
        <span
          className="absolute -left-[7px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-accent"
          aria-hidden
        />
        <p className="body-sm text-fg">{event.label}</p>
        <p className="body-xs text-fg-subtle">
          {event.at}
          {event.actor ? <> · {event.actor}</> : null}
        </p>
      </li>
    ))}
  </ol>
)
