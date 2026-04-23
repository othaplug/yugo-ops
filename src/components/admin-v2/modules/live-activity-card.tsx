"use client"

import * as React from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  type ActivityEventRow,
  formatActivityTime,
  getActivityHref,
  formatActivityDescription,
} from "@/app/admin/components/activity-feed-shared"
import { cn } from "../lib/cn"

type Props = {
  initialEvents: ActivityEventRow[]
}

/**
 * Live activity stream (status_events) with admin-v2 styling only.
 * Logic matches the legacy LiveActivityFeed; visuals use v2 tokens (no gold / admin-primary).
 */
export const LiveActivityCard = ({ initialEvents }: Props) => {
  const [events, setEvents] = React.useState<ActivityEventRow[]>(initialEvents)
  const [unreadIds, setUnreadIds] = React.useState<Set<string>>(new Set())
  const [, setTick] = React.useState(0)
  const seenIds = React.useRef(new Set(initialEvents.map((e) => e.id)))
  const supabase = createClient()

  const mergeEvents = React.useCallback(
    (incoming: ActivityEventRow[], onNewIds?: (ids: string[]) => void) => {
      const newIds: string[] = []
      setEvents((prev) => {
        const merged = [...prev]
        for (const e of incoming) {
          if (!seenIds.current.has(e.id)) {
            seenIds.current.add(e.id)
            merged.unshift(e)
            newIds.push(e.id)
          }
        }
        if (newIds.length === 0) return prev
        merged.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        return merged.slice(0, 30)
      })
      if (newIds.length > 0 && onNewIds) onNewIds(newIds)
    },
    [],
  )

  React.useEffect(() => {
    const channel = supabase
      .channel("activity-feed-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "status_events" },
        (payload) => {
          const row = payload.new as ActivityEventRow
          if (row?.id)
            mergeEvents([row], (ids) =>
              setUnreadIds((prev) => new Set([...prev, ...ids])),
            )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, mergeEvents])

  React.useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await supabase
          .from("status_events")
          .select(
            "id, entity_type, entity_id, event_type, description, icon, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(12)
        if (data?.length)
          mergeEvents(data, (ids) =>
            setUnreadIds((prev) => new Set([...prev, ...ids])),
          )
      } catch {
        /* silent */
      }
    }

    const id = setInterval(poll, 5_000)
    return () => clearInterval(id)
  }, [supabase, mergeEvents])

  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(timer)
  }, [])

  const visible = events.slice(0, 8)

  /**
   * Layout matches the legacy /admin command center: border-top section, compact
   * header (title + live dot + View all), no outer card frame.
   */
  return (
    <section
      className="min-w-0 border-t border-line/80 pt-6"
      aria-label="Activity feed"
    >
      <div className="mb-3 flex w-full min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="min-w-0 text-fg heading-md">Activity</h2>
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
        </div>
        {events.length > 0 ? (
          <Link
            href="/admin/activity"
            className="shrink-0 text-xs font-semibold text-fg-subtle transition-colors hover:text-fg"
          >
            View all
          </Link>
        ) : null}
      </div>
      {visible.length > 0 ? (
        <div className="flex max-h-[min(320px,42vh)] min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
          {visible.map((e, idx) => {
            const isUnread = unreadIds.has(e.id)
            return (
              <Link
                key={`${e.id}-${idx}`}
                href={getActivityHref(e)}
                onClick={() =>
                  setUnreadIds((prev) => {
                    const n = new Set(prev)
                    n.delete(e.id)
                    return n
                  })
                }
                className={cn(
                  "group block rounded-xl border px-3 py-2.5 transition-colors sm:px-3.5",
                  isUnread
                    ? "border-accent/35 bg-accent-subtle/80"
                    : "border-line/40 bg-surface/50 hover:bg-surface",
                )}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  {isUnread ? (
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      aria-hidden
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p
                        className={cn(
                          "line-clamp-4 whitespace-normal wrap-break-word text-[13px] font-semibold leading-snug",
                          isUnread ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        {formatActivityDescription(
                          e.description || e.event_type,
                          { truncateAt: null },
                        )}
                      </p>
                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-fg-subtle sm:pt-0.5">
                        {formatActivityTime(e.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="py-3 text-[13px] font-medium text-fg-subtle">No recent activity</p>
      )}
    </section>
  )
}
