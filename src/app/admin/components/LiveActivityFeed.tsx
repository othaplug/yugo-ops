"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getStatusLabel } from "@/lib/move-status";

type ActivityEvent = {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  description: string | null;
  icon: string | null;
  created_at: string;
};

function formatTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getHref(e: ActivityEvent): string {
  if (e.entity_type === "move") return `/admin/moves/${e.entity_id}`;
  if (e.entity_type === "delivery") return e.entity_id ? `/admin/deliveries/${e.entity_id}` : "/admin/deliveries";
  if (e.entity_type === "invoice") return "/admin/invoices";
  return "/admin";
}

function formatDesc(desc: string): string {
  const match = desc.match(/Notification sent to (.+?): Status is (.+)$/);
  if (match) return `${match[1]} · ${getStatusLabel(match[2] || null)}`;
  if (desc.toLowerCase().includes("payment")) {
    const nameMatch = desc.match(/(.+?)\s*[·—]/);
    return nameMatch ? `${nameMatch[1].trim()} · Paid` : desc;
  }
  return desc.length > 60 ? desc.slice(0, 57) + "..." : desc;
}

export default function LiveActivityFeed({ initialEvents }: { initialEvents: ActivityEvent[] }) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const seenIds = useRef(new Set(initialEvents.map((e) => e.id)));
  const supabase = createClient();

  const mergeEvents = useCallback((incoming: ActivityEvent[], onNewIds?: (ids: string[]) => void) => {
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
          const row = payload.new as ActivityEvent;
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Activity</h2>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--gold)]" />
          </span>
        </div>
        {events.length > 8 && (
          <Link
            href="/admin/reports"
            className="text-[10px] font-semibold text-[var(--gold)] hover:underline transition-colors"
          >
            View all →
          </Link>
        )}
      </div>
      {visible.length > 0 ? (
        <div className="divide-y divide-[var(--brd)]/20">
          {visible.map((e, idx) => {
            const isUnread = unreadIds.has(e.id);
            return (
              <Link
                key={`${e.id}-${idx}`}
                href={getHref(e)}
                onClick={() => setUnreadIds((prev) => { const n = new Set(prev); n.delete(e.id); return n; })}
                className="group flex items-start gap-2.5 py-3 px-1 hover:bg-[var(--card)]/30 transition-colors rounded-lg"
              >
                {isUnread && (
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--gold)] shrink-0" />
                )}
                <div className={`flex-1 min-w-0 ${isUnread ? "" : "pl-4"}`}>
                  <div className={`text-[11px] leading-snug truncate ${isUnread ? "font-semibold text-[var(--tx)]" : "text-[var(--tx2)]"}`}>
                    {formatDesc(e.description || e.event_type)}
                  </div>
                  <div className="text-[9px] text-[var(--tx3)] mt-0.5">{formatTime(e.created_at)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--tx3)] py-3">No recent activity</p>
      )}
    </div>
  );
}
