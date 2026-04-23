"use client"

import * as React from "react"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  DrawerTabs,
} from "../layout/Drawer"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../primitives/Tabs"
import { Avatar } from "../primitives/Avatar"
import { Button } from "../primitives/Button"
import { cn } from "../lib/cn"

export type Notification = {
  id: string
  title: string
  body: string
  actor: string
  at: string
  read: boolean
  mention?: boolean
  href?: string
}

const relativeLabel = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const MOCK: Notification[] = [
  {
    id: "n1",
    title: "New lead assigned",
    body: "Andy Shepard came in from Organic.",
    actor: "System",
    at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    read: false,
    mention: true,
  },
  {
    id: "n2",
    title: "Quote viewed",
    body: "Sophia Morgan opened quote Q-2042 for the second time.",
    actor: "HubSpot",
    at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    read: false,
  },
  {
    id: "n3",
    title: "Move rescheduled",
    body: "Michael Carter moved #M-1190 to Friday at 9 AM.",
    actor: "Emily Thompson",
    at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: true,
  },
  {
    id: "n4",
    title: "Payment received",
    body: "Invoice INV-4022 paid via Square.",
    actor: "Square",
    at: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    read: true,
  },
  {
    id: "n5",
    title: "Crew late check-in",
    body: "Truck 07 arrived 12 minutes late at origin.",
    actor: "Dispatch",
    at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
  },
]

const bucket = (at: string): "Today" | "Yesterday" | "This week" => {
  const diff = Date.now() - new Date(at).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return "Today"
  if (diff < 2 * day) return "Yesterday"
  return "This week"
}

type NotificationsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const NotificationsDrawer = ({
  open,
  onOpenChange,
}: NotificationsDrawerProps) => {
  const [items, setItems] = React.useState<Notification[]>(MOCK)

  const markAllRead = () =>
    setItems((prev) => prev.map((item) => ({ ...item, read: true })))

  const list = (filter: "all" | "unread" | "mentions") => {
    const rows = items.filter((item) => {
      if (filter === "unread") return !item.read
      if (filter === "mentions") return item.mention
      return true
    })
    const buckets: Record<string, Notification[]> = {
      Today: [],
      Yesterday: [],
      "This week": [],
    }
    for (const row of rows) {
      buckets[bucket(row.at)]!.push(row)
    }
    return buckets
  }

  const renderBuckets = (buckets: Record<string, Notification[]>) =>
    Object.entries(buckets).map(([label, rows]) =>
      rows.length === 0 ? null : (
        <section key={label} className="space-y-1">
          <p className="label-sm text-fg-subtle">{label}</p>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {rows.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex gap-3 px-3 py-3",
                  !item.read && "bg-accent-subtle/40",
                )}
              >
                <Avatar name={item.actor} size="sm" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="label-md text-fg truncate">{item.title}</p>
                    {!item.read ? (
                      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                    ) : null}
                  </div>
                  <p className="body-sm text-fg truncate">{item.body}</p>
                  <p className="body-xs text-fg-subtle">
                    {item.actor} · {relativeLabel(item.at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ),
    )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent widthClass="w-[min(420px,92vw)]">
        <DrawerHeader
          title="Notifications"
          description={`${items.filter((i) => !i.read).length} unread`}
        />
        <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col">
          <DrawerTabs className="flex items-center justify-between gap-4">
            <TabsList className="h-11 gap-5 border-0 p-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="mentions">Mentions</TabsTrigger>
            </TabsList>
            <Button size="sm" variant="ghost" onClick={markAllRead}>
              Mark all read
            </Button>
          </DrawerTabs>
          {["all", "unread", "mentions"].map((filter) => (
            <TabsContent
              key={filter}
              value={filter}
              className="min-h-0 flex-1 data-[state=inactive]:hidden"
              forceMount
            >
              <DrawerBody>
                <div className="space-y-4">{renderBuckets(list(filter as "all" | "unread" | "mentions"))}</div>
              </DrawerBody>
            </TabsContent>
          ))}
        </Tabs>
      </DrawerContent>
    </Drawer>
  )
}
