"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BackButton from "../components/BackButton";
import {
  type ActivityEventRow,
  formatActivityTime,
  getActivityHref,
  formatActivityDescription,
} from "../components/activity-feed-shared";

export default function ActivityPageClient({
  initialEvents,
}: {
  initialEvents: ActivityEventRow[];
}) {
  const [events, setEvents] = useState<ActivityEventRow[]>(initialEvents);
  const [, setTick] = useState(0);
  const seenIds = useRef(new Set(initialEvents.map((e) => e.id)));
  const supabase = createClient();

  const mergeEvents = useCallback((incoming: ActivityEventRow[]) => {
    setEvents((prev) => {
      const merged = [...prev];
      let changed = false;
      for (const e of incoming) {
        if (!seenIds.current.has(e.id)) {
          seenIds.current.add(e.id);
          merged.unshift(e);
          changed = true;
        }
      }
      if (!changed) return prev;
      merged.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return merged.slice(0, 500);
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("activity-full-page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "status_events" },
        (payload) => {
          const row = payload.new as ActivityEventRow;
          if (row?.id) mergeEvents([row]);
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
          .limit(80);
        if (data?.length) mergeEvents(data);
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

  const visible = events;

  return (
    <div className="w-full min-w-0 py-4 sm:py-5 md:py-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <BackButton href="/admin" />
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="admin-page-hero text-[var(--tx)] truncate">
            Activity
          </h1>
        </div>
      </div>
      <p className="text-[var(--text-md)] text-[var(--tx3)] mb-4 leading-snug font-medium">
        Live stream of operations across admin and crew — jobs, billing, crews, and
        client touchpoints.
      </p>

      {visible.length > 0 ? (
        <div className="max-h-[min(70vh,560px)] min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-2 pr-0.5">
          {visible.map((e, idx) => (
            <Link
              key={`${e.id}-${idx}`}
              href={getActivityHref(e)}
              className="group block rounded-xl border border-[var(--brd)]/25 bg-[var(--card)]/50 px-3 py-3 sm:px-3.5 transition-colors hover:bg-[var(--card)]/80 hover:border-[var(--brd)]/40"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                <p className="text-[13px] leading-snug font-semibold text-[var(--tx)] group-hover:text-[var(--accent-text)] transition-colors whitespace-normal line-clamp-6 [overflow-wrap:anywhere]">
                  {formatActivityDescription(e.description || e.event_type, {
                    truncateAt: null,
                  })}
                </p>
                <span className="text-[10px] font-semibold tabular-nums text-[var(--tx3)] shrink-0 sm:pt-0.5">
                  {formatActivityTime(e.created_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[var(--text-base)] text-[var(--tx3)] py-8 text-center font-medium">
          No activity yet
        </p>
      )}
    </div>
  );
}
