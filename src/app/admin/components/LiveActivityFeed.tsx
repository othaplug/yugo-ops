"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  type ActivityEventRow,
  formatActivityTime,
  getActivityHref,
  formatActivityDescription,
} from "./activity-feed-shared";

export default function LiveActivityFeed({
  initialEvents,
}: {
  initialEvents: ActivityEventRow[];
}) {
  const [events, setEvents] = useState<ActivityEventRow[]>(initialEvents);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const seenIds = useRef(new Set(initialEvents.map((e) => e.id)));
  const supabase = createClient();

  const mergeEvents = useCallback(
    (incoming: ActivityEventRow[], onNewIds?: (ids: string[]) => void) => {
      const newIds: string[] = [];
      setEvents((prev) => {
        const merged = [...prev];
        for (const e of incoming) {
          if (!seenIds.current.has(e.id)) {
            seenIds.current.add(e.id);
            merged.unshift(e);
            newIds.push(e.id);
          }
        }
        if (newIds.length === 0) return prev;
        merged.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        return merged.slice(0, 30);
      });
      if (newIds.length > 0 && onNewIds) onNewIds(newIds);
    },
    [],
  );

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "status_events" },
        (payload) => {
          const row = payload.new as ActivityEventRow;
          if (row?.id)
            mergeEvents([row], (ids) =>
              setUnreadIds((prev) => new Set([...prev, ...ids])),
            );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, mergeEvents]);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await supabase
          .from("status_events")
          .select(
            "id, entity_type, entity_id, event_type, description, icon, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(12);
        if (data?.length)
          mergeEvents(data, (ids) =>
            setUnreadIds((prev) => new Set([...prev, ...ids])),
          );
      } catch {
        /* silent */
      }
    };

    const id = setInterval(poll, 5_000);
    return () => clearInterval(id);
  }, [supabase, mergeEvents]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const visible = events.slice(0, 8);

  return (
    <div className="pt-6 border-t border-[var(--brd)]/30">
      <div className="flex items-center justify-between gap-2 mb-3 min-w-0 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="admin-section-h2">Activity</h2>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--admin-primary-fill)] opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--admin-primary-fill)]" />
          </span>
        </div>
        {events.length > 0 && (
          <Link href="/admin/activity" className="admin-view-all-link shrink-0">
            View all
          </Link>
        )}
      </div>
      {visible.length > 0 ? (
        <div className="max-h-[min(320px,42vh)] min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5">
          {visible.map((e, idx) => {
            const isUnread = unreadIds.has(e.id);
            return (
              <Link
                key={`${e.id}-${idx}`}
                href={getActivityHref(e)}
                onClick={() =>
                  setUnreadIds((prev) => {
                    const n = new Set(prev);
                    n.delete(e.id);
                    return n;
                  })
                }
                className={`group block rounded-xl border px-3 py-2.5 transition-colors sm:px-3.5 ${
                  isUnread
                    ? "border-[var(--admin-primary-fill)]/35 bg-[var(--admin-primary-fill)]/[0.06]"
                    : "border-[var(--brd)]/25 bg-[var(--card)]/50 hover:bg-[var(--card)]/80"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {isUnread && (
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--admin-primary-fill)] shrink-0" />
                  )}
                  <div
                    className={`min-w-0 flex-1 ${isUnread ? "" : "pl-0 sm:pl-0"}`}
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <p
                        className={`text-[13px] leading-snug font-semibold whitespace-normal line-clamp-4 [overflow-wrap:anywhere] ${isUnread ? "text-[var(--tx)]" : "text-[var(--tx2)]"}`}
                      >
                        {formatActivityDescription(
                          e.description || e.event_type,
                          { truncateAt: null },
                        )}
                      </p>
                      <span className="text-[10px] font-semibold tabular-nums shrink-0 sm:pt-0.5 text-[var(--tx3)]">
                        {formatActivityTime(e.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--tx3)] py-3 font-medium">
          No recent activity
        </p>
      )}
    </div>
  );
}
