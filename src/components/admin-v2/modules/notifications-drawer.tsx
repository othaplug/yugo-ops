"use client"

import * as React from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  type ActivityEventRow,
  formatActivityTime,
  formatActivityDescription,
  getActivityHref,
} from "@/app/admin/components/activity-feed-shared"
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

// Re-export the Notification type for external use if needed.
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

const bucket = (at: string): "Today" | "Yesterday" | "This week" => {
  const diff = Date.now() - new Date(at).getTime()
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return "Today"
  if (diff < 2 * day) return "Yesterday"
  return "This week"
}

const actorFromEvent = (e: ActivityEventRow): string => {
  if (e.entity_type === "move") return "Moves"
  if (e.entity_type === "quote") return "Quotes"
  if (e.entity_type === "invoice") return "Invoices"
  if (e.entity_type === "delivery") return "Dispatch"
  if (e.entity_type === "crew") return "Crew"
  return "System"
}

const eventToNotification = (e: ActivityEventRow): Notification => ({
  id: e.id,
  title: e.event_type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()),
  body: e.description ?? e.event_type,
  actor: actorFromEvent(e),
  at: e.created_at,
  read: false,
  href: getActivityHref(e),
})

type NotificationsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnreadCountChange?: (count: number) => void
}

export const NotificationsDrawer = ({
  open,
  onOpenChange,
  onUnreadCountChange,
}: NotificationsDrawerProps) => {
  const [items, setItems] = React.useState<Notification[]>([])
  const [loading, setLoading] = React.useState(false)
  const seenIds = React.useRef(new Set<string>())
  const supabase = createClient()

  // Initial load when drawer opens.
  React.useEffect(() => {
    if (!open) return
    if (items.length > 0) return // already loaded
    setLoading(true)
    supabase
      .from("status_events")
      .select("id, entity_type, entity_id, event_type, description, icon, created_at")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data) return
        const rows = data as ActivityEventRow[]
        const notifs = rows.map(eventToNotification)
        for (const n of notifs) seenIds.current.add(n.id)
        setItems(notifs)
      })
      .then(() => setLoading(false), () => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription.
  React.useEffect(() => {
    const channel = supabase
      .channel("notifications-drawer")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "status_events" },
        (payload) => {
          const row = payload.new as ActivityEventRow
          if (!row?.id || seenIds.current.has(row.id)) return
          seenIds.current.add(row.id)
          const notif = eventToNotification(row)
          setItems((prev) => [notif, ...prev].slice(0, 30))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const [readIds, setReadIds] = React.useState<Set<string>>(new Set())

  const markAllRead = () =>
    setReadIds(new Set(items.map((i) => i.id)))

  const markRead = (id: string) =>
    setReadIds((prev) => new Set([...prev, id]))

  const isRead = (item: Notification) => readIds.has(item.id) || item.read

  const unreadCount = items.filter((i) => !isRead(i)).length

  React.useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [unreadCount, onUnreadCountChange])

  const filteredList = (filter: "all" | "unread") => {
    const rows = filter === "unread" ? items.filter((i) => !isRead(i)) : items
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
                  !isRead(item) && "bg-accent-subtle/40",
                )}
              >
                <Avatar name={item.actor} size="sm" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="label-md text-fg truncate hover:underline"
                        onClick={() => {
                          markRead(item.id)
                          onOpenChange(false)
                        }}
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="label-md text-fg truncate">{item.title}</p>
                    )}
                    {!isRead(item) ? (
                      <span className="size-1.5 rounded-full bg-accent shrink-0" aria-hidden />
                    ) : null}
                  </div>
                  <p className="body-sm text-fg truncate">{item.body}</p>
                  <p className="body-xs text-fg-subtle">
                    {item.actor} · {formatActivityTime(item.at)}
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
          description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        />
        <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col">
          <DrawerTabs className="flex items-center justify-between gap-4">
            <TabsList className="h-11 gap-5 border-0 p-0">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
            </TabsList>
            {unreadCount > 0 && (
              <Button size="sm" variant="ghost" onClick={markAllRead}>
                Mark all read
              </Button>
            )}
          </DrawerTabs>
          {["all", "unread"].map((filter) => (
            <TabsContent
              key={filter}
              value={filter}
              className="min-h-0 flex-1 data-[state=inactive]:hidden"
              forceMount
            >
              <DrawerBody>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="body-sm text-fg-subtle">Loading…</span>
                  </div>
                ) : items.length === 0 ? (
                  <p className="py-8 text-center body-sm text-fg-subtle">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-4">
                    {renderBuckets(filteredList(filter as "all" | "unread"))}
                  </div>
                )}
              </DrawerBody>
            </TabsContent>
          ))}
        </Tabs>
      </DrawerContent>
    </Drawer>
  )
}
