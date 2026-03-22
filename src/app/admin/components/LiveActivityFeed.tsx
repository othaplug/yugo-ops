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

export default function LiveActivityFeed({ initialEvents }: { initialEvents: ActivityEventRow[] }) {
  const [events, setEvents] = useState<ActivityEventRow[]>(initialEvents);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const seenIds = useRef(new Set(initialEvents.map((e) => e.id)));
  const supabase = createClient();

  const mergeEvents = useCallback((incoming: ActivityEventRow[], onNewIds?: (ids: string[]) => void) => {
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
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return merged.slice(0, 30);
    });
    if (newIds.length > 0 && onNewIds) onNewIds(newIds);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "status_events" },
        (payload) => {
          const row = payload.new as ActivityEventRow;
          if (row?.id) mergeEvents([row], (ids) => setUnreadIds((prev) => new Set([...prev, ...ids])));
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
          .select("id, entity_type, entity_id, event_type, description, icon, created_at")
          .order("created_at", { ascending: false })
          .limit(12);
        if (data?.length) mergeEvents(data, (ids) => setUnreadIds((prev) => new Set([...prev, ...ids])));
      } catch {
        /* silent */
      }
    };

    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [supabase, mergeEvents]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const visible = events
    .filter((a, i) => i === 0 || events[i - 1].description !== a.description)
    .slice(0, 8);

  return (
    <div className="pt-6 border-t border-[var(--brd)]/30">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Activity</h2>
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--gold)]" />
          </span>
        </div>
        {events.length > 0 && (
          <Link href="/admin/activity" className="admin-view-all-link shrink-0">
            View all
          </Link>
        )}
      </div>
      {visible.length > 0 ? (
        <div className="max-h-[min(280px,38vh)] overflow-y-auto overscroll-contain rounded-lg border border-[var(--brd)]/40 divide-y divide-[var(--brd)]/20">
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
                className="group flex items-start gap-2.5 py-3 px-2 sm:px-2.5 hover:bg-[var(--card)]/30 transition-colors"
              >
                {isUnread && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" />}
                <div className={`flex-1 min-w-0 ${isUnread ? "" : "pl-4"}`}>
                  <div
                    className={`text-[13px] leading-snug truncate font-semibold ${isUnread ? "text-[var(--tx)]" : "text-[var(--tx2)]"}`}
                  >
                    {formatActivityDescription(e.description || e.event_type)}
                  </div>
                  <div className="text-[11px] text-[var(--tx3)] mt-0.5 font-medium">{formatActivityTime(e.created_at)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--tx3)] py-3 font-medium">No recent activity</p>
      )}
    </div>
  );
}
