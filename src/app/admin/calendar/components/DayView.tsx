"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, timeToMinutes, JOB_COLORS, STATUS_DOT_COLORS } from "@/lib/calendar/types";

const HOUR_HEIGHT = 60;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);

interface Props {
  date: string;
  todayKey: string;
  events: CalendarEvent[];
  crews: { id: string; name: string; memberCount: number }[];
  onEventClick: (e: CalendarEvent) => void;
  onEmptyClick: (crewId: string, time: string) => void;
}

function getTopOffset(time: string | null): number {
  if (!time) return 0;
  const mins = timeToMinutes(time);
  return ((mins - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function getHeight(start: string | null, end: string | null, durationHours: number | null): number {
  if (start && end) {
    const diff = timeToMinutes(end) - timeToMinutes(start);
    return Math.max((diff / 60) * HOUR_HEIGHT, 30);
  }
  if (durationHours) return Math.max(durationHours * HOUR_HEIGHT, 30);
  return 1.5 * HOUR_HEIGHT;
}

const TYPE_ICONS: Record<string, string> = { move: "🚚", delivery: "📦", project_phase: "🎨", blocked: "🚫" };

export default function DayView({ date, todayKey, events, crews, onEventClick, onEmptyClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = date === todayKey
        ? Math.max(((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT - 120, 0)
        : 2 * HOUR_HEIGHT;
      containerRef.current.scrollTop = scrollTo;
    }
  }, [date, todayKey, nowMinutes]);

  const unassigned = useMemo(
    () => events.filter((e) => !e.crewId && e.type !== "blocked"),
    [events]
  );

  const eventsByCrew = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const c of crews) map[c.id] = [];
    for (const e of events) {
      if (e.crewId && map[e.crewId]) map[e.crewId].push(e);
    }
    return map;
  }, [events, crews]);

  const isToday = date === todayKey;
  const nowTop = ((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNow = isToday && nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60;

  const columns = [
    ...crews.map((c) => ({ id: c.id, label: c.name, sub: `${c.memberCount} members` })),
    { id: "__unassigned", label: "Unassigned", sub: "" },
  ];

  return (
    <div className="px-6 pb-6">
      {/* Column headers */}
      <div className="flex border-b border-[var(--brd)]">
        <div className="w-16 shrink-0" />
        {columns.map((col) => (
          <div key={col.id} className="flex-1 min-w-[160px] px-2 py-2 text-center border-l border-[var(--brd)]">
            <div className="text-[11px] font-bold text-[var(--tx)]">{col.label}</div>
            {col.sub && <div className="text-[9px] text-[var(--tx3)]">{col.sub}</div>}
          </div>
        ))}
      </div>

      {/* Timeline grid */}
      <div ref={containerRef} className="overflow-y-auto max-h-[calc(100vh-240px)] relative">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div className="w-16 shrink-0 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-2 text-[10px] text-[var(--tx3)] font-medium"
                style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 6 }}
              >
                {formatTime12(`${String(h).padStart(2, "0")}:00`)}
              </div>
            ))}
          </div>

          {/* Crew columns */}
          {columns.map((col) => {
            const colEvents = col.id === "__unassigned" ? unassigned : (eventsByCrew[col.id] || []);
            return (
              <div
                key={col.id}
                className="flex-1 min-w-[160px] relative border-l border-[var(--brd)]"
                onClick={(e) => {
                  if (col.id === "__unassigned") return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
                  const rawMins = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
                  const snapped = Math.round(rawMins / 15) * 15;
                  const h = Math.floor(snapped / 60);
                  const m = snapped % 60;
                  onEmptyClick(col.id, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
                }}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-[var(--brd)]/30"
                    style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}
                {/* 30-min lines */}
                {HOURS.slice(0, -1).map((h) => (
                  <div
                    key={`half-${h}`}
                    className="absolute w-full border-t border-[var(--brd)]/10"
                    style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Event blocks */}
                {colEvents.map((ev) => {
                  const top = getTopOffset(ev.start);
                  const height = getHeight(ev.start, ev.end, ev.durationHours);
                  const dotColor = STATUS_DOT_COLORS[ev.calendarStatus] || STATUS_DOT_COLORS.scheduled;
                  const isComplete = ev.calendarStatus === "completed";
                  const isProgress = ev.calendarStatus === "in_progress";

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={`absolute left-1 right-1 rounded-md overflow-hidden text-left transition-all hover:brightness-110 hover:shadow-lg cursor-pointer ${
                        isComplete ? "opacity-50" : ""
                      }`}
                      style={{
                        top,
                        height: Math.max(height, 30),
                        borderLeft: `3px solid ${ev.color}`,
                        background: `linear-gradient(135deg, ${ev.color}18, ${ev.color}08)`,
                      }}
                    >
                      <div className="p-1.5 h-full flex flex-col">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isProgress ? "animate-pulse" : ""}`} style={{ backgroundColor: dotColor }} />
                          <span className="text-[11px] font-bold text-[var(--tx)] truncate">{ev.name}</span>
                        </div>
                        <div className="text-[9px] text-[var(--tx3)] truncate">
                          {TYPE_ICONS[ev.type] || ""} {ev.description}
                        </div>
                        {height > 60 && ev.truckName && (
                          <div className="text-[8px] text-[var(--tx3)]/60 mt-0.5 truncate">
                            {ev.truckName}{ev.crewName ? ` · ${ev.crewName}` : ""}
                          </div>
                        )}
                        {height > 80 && ev.start && ev.end && (
                          <div className="text-[8px] text-[var(--tx3)]/50 mt-auto">
                            {formatTime12(ev.start)} – {formatTime12(ev.end)}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* NOW indicator */}
        {showNow && (
          <div
            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
            style={{ top: nowTop }}
          >
            <div className="w-16 text-right pr-1">
              <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded">
                NOW
              </span>
            </div>
            <div className="flex-1 h-[2px] bg-red-500/70" />
          </div>
        )}
      </div>
    </div>
  );
}
