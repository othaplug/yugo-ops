"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, timeToMinutes, minutesToTime, STATUS_DOT_COLORS } from "@/lib/calendar/types";
const HOUR_HEIGHT = 48;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);
const DRAG_THRESHOLD = 6;
const DRAGGABLE_TYPES = ["move", "delivery", "blocked"] as const;

interface Props {
  date: string;
  todayKey: string;
  events: CalendarEvent[];
  crews: { id: string; name: string; memberCount: number }[];
  onEventClick: (e: CalendarEvent) => void;
  onEmptyClick: (crewId: string, time: string) => void;
  onEventRescheduled?: () => void;
}

function getTopOffset(time: string | null): number {
  if (!time) return 0;
  return ((timeToMinutes(time) - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function getHeight(start: string | null, end: string | null, durationHours: number | null): number {
  if (start && end) return Math.max(((timeToMinutes(end) - timeToMinutes(start)) / 60) * HOUR_HEIGHT, 30);
  if (durationHours) return Math.max(durationHours * HOUR_HEIGHT, 30);
  return 1.5 * HOUR_HEIGHT;
}

function yToTime(y: number): string {
  const rawMins = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(rawMins / 15) * 15;
  return minutesToTime(Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - 15, snapped)));
}

const TYPE_ICON_MAP: Record<string, string> = {
  move: "mapPin",
  delivery: "package",
  project_phase: "palette",
  project: "projects",
  blocked: "lock",
};

/** Completed jobs can only be dragged/edited if they have no time and no team assigned */
function canEditEvent(ev: CalendarEvent): boolean {
  if (ev.calendarStatus !== "completed") return true;
  const hasTime = !!(ev.start || ev.end);
  const hasTeam = !!ev.crewId;
  return !hasTime && !hasTeam;
}

export default function DayView({
  date,
  todayKey,
  events,
  crews,
  onEventClick,
  onEmptyClick,
  onEventRescheduled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  // ── Pointer-based drag state (all in refs to avoid re-render loops mid-drag)
  const dragRef = useRef<{
    event: CalendarEvent;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropCrewId, setDropCrewId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Keep callback refs fresh so window listeners never have stale closures
  const onEventClickRef = useRef(onEventClick);
  onEventClickRef.current = onEventClick;
  const onEventRescheduledRef = useRef(onEventRescheduled);
  onEventRescheduledRef.current = onEventRescheduled;
  const dateRef = useRef(date);
  dateRef.current = date;
  const reschedulingRef = useRef(rescheduling);
  reschedulingRef.current = rescheduling;

  // ── Now ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-scroll to current time
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo =
        date === todayKey
          ? Math.max(((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT - 120, 0)
          : 2 * HOUR_HEIGHT;
      containerRef.current.scrollTop = scrollTo;
    }
  }, [date, todayKey, nowMinutes]);

  // ── Computed event lists
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

  // ── Reschedule API call (uses refs so always fresh)
  const doReschedule = useCallback(
    async (ev: CalendarEvent, newCrewId: string, newStart: string) => {
      const durationMins =
        ev.start && ev.end ? timeToMinutes(ev.end) - timeToMinutes(ev.start) : 120;
      const newEnd = minutesToTime(
        Math.min(timeToMinutes(newStart) + durationMins, DAY_END_HOUR * 60)
      );

      setRescheduling(true);
      try {
        const res = await fetch("/api/admin/calendar/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: ev.type === "blocked" ? ev.scheduleBlockId || ev.id : ev.id,
            event_type: ev.type,
            crew_id: newCrewId,
            date: dateRef.current,
            start: newStart,
            end: newEnd,
          }),
        });
        if (res.ok) {
          onEventRescheduledRef.current?.();
        } else {
          const data = await res.json();
          alert(data.error || "Failed to reschedule");
        }
      } catch {
        alert("Network error while rescheduling");
      } finally {
        setRescheduling(false);
      }
    },
    []
  );

  // ── Global pointer move / up listeners (attached once, uses refs)
  useEffect(() => {
    const getCandidateColumn = (x: number, y: number): { crewId: string; rect: DOMRect } | null => {
      // Walk up the DOM from the element at the pointer position to find a crew column
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const colEl = (el as HTMLElement).closest("[data-crew-col]") as HTMLElement | null;
      if (!colEl) return null;
      const crewId = colEl.dataset.crewCol || null;
      if (!crewId || crewId === "__unassigned") return null;
      return { crewId, rect: colEl.getBoundingClientRect() };
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || reschedulingRef.current) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (!d.isDragging) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        d.isDragging = true;
        setDraggingEvent(d.event);
      }

      setDragPos({ x: e.clientX, y: e.clientY });

      const col = getCandidateColumn(e.clientX, e.clientY);
      setDropCrewId(col ? col.crewId : null);
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;

      if (!d) return;

      setDraggingEvent(null);
      setDragPos(null);
      setDropCrewId(null);

      if (!d.isDragging) {
        // Short tap/click — open detail panel
        onEventClickRef.current(d.event);
        return;
      }

      if (reschedulingRef.current) return;

      const col = getCandidateColumn(e.clientX, e.clientY);
      if (col) {
        const y = e.clientY - col.rect.top;
        const newStart = yToTime(y);
        doReschedule(d.event, col.crewId, newStart);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [doReschedule]);

  const isToday = date === todayKey;
  const nowTop = ((nowMinutes - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const showNow = isToday && nowMinutes >= DAY_START_HOUR * 60 && nowMinutes <= DAY_END_HOUR * 60;

  const columns = [
    ...crews.map((c) => ({ id: c.id, label: c.name, sub: `${c.memberCount} members` })),
    { id: "__unassigned", label: "Unassigned", sub: "" },
  ];

  return (
    <div className={`px-2 sm:px-4 pb-3 ${draggingEvent ? "select-none" : ""}`}>
      {/* Horizontal scroll wrapper — headers + unscheduled strip + timeline all scroll together */}
      <div className="overflow-x-auto">
        {/* Column headers */}
        <div className="flex border-b border-[var(--brd)]">
          <div className="w-12 sm:w-16 shrink-0" />
          {columns.map((col) => (
            <div
              key={col.id}
              className="w-[120px] sm:flex-1 sm:min-w-[140px] shrink-0 px-2 py-2 text-center border-l border-[var(--brd)]"
            >
              <div className="text-[11px] font-bold text-[var(--tx)] truncate">{col.label}</div>
              {col.sub && <div className="text-[9px] text-[var(--tx3)]">{col.sub}</div>}
            </div>
          ))}
        </div>

        {/* All-day / Unscheduled strip */}
        {columns.some((col) => {
          const evs = col.id === "__unassigned" ? unassigned : eventsByCrew[col.id] || [];
          return evs.some((ev) => !ev.start);
        }) && (
          <div className="flex border-b border-[var(--brd)] bg-[var(--bg)]/40">
            <div className="w-12 sm:w-16 shrink-0 py-1.5 flex items-center justify-end pr-1.5">
              <span className="text-[7px] sm:text-[8px] font-semibold text-[var(--tx3)]/60 uppercase tracking-wide">Unsched.</span>
            </div>
            {columns.map((col) => {
              const allColEvs = col.id === "__unassigned" ? unassigned : eventsByCrew[col.id] || [];
              const untimed = allColEvs.filter((ev) => !ev.start);
              return (
                <div
                  key={col.id}
                  className="w-[120px] sm:flex-1 sm:min-w-[140px] shrink-0 border-l border-[var(--brd)] py-1 px-1 flex flex-col gap-0.5 min-h-[34px]"
                >
                  {untimed.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onEventClick(ev)}
                      className="w-full text-left rounded px-1.5 py-0.5 text-[9px] font-bold truncate"
                      style={{
                        backgroundColor: `${ev.color}25`,
                        color: ev.color,
                        borderLeft: `3px solid ${ev.color}`,
                      }}
                    >
                      {ev.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline grid — vertical scroll only; horizontal handled by parent */}
        <div
          ref={containerRef}
          className="overflow-y-auto max-h-[calc(100vh-170px)] sm:max-h-[calc(100vh-200px)] relative"
        >
          <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {/* Time labels */}
            <div className="w-12 sm:w-16 shrink-0 relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-1 sm:pr-2 text-[9px] sm:text-[10px] text-[var(--tx3)] font-medium"
                  style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 6 }}
                >
                  {formatTime12(`${String(h).padStart(2, "0")}:00`)}
                </div>
              ))}
            </div>

            {/* Crew columns */}
            {columns.map((col) => {
              const allColEvents = col.id === "__unassigned" ? unassigned : eventsByCrew[col.id] || [];
              const colEvents = allColEvents.filter((ev) => ev.start);
              const isActiveDropTarget =
                col.id !== "__unassigned" &&
                draggingEvent !== null &&
                dropCrewId === col.id;
              const isValidDrop =
                col.id !== "__unassigned" && draggingEvent !== null && dropCrewId === null;

              return (
                <div
                  key={col.id}
                  data-crew-col={col.id}
                  className={`w-[120px] sm:flex-1 sm:min-w-[140px] shrink-0 relative border-l border-[var(--brd)] transition-colors duration-100 ${
                    isActiveDropTarget
                      ? "bg-[var(--gold)]/10 ring-1 ring-inset ring-[var(--gold)]/40"
                      : ""
                  }`}
                  onClick={(e) => {
                    // Only trigger for clicks directly on empty space, not bubbling from event cards
                    if ((e.target as HTMLElement).closest("[data-event-card]")) return;
                    if (col.id === "__unassigned") return;
                    if (draggingEvent) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top + (containerRef.current?.scrollTop || 0);
                    const rawMins = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
                    const snapped = Math.round(rawMins / 15) * 15;
                    const h = Math.floor(snapped / 60);
                    const m = snapped % 60;
                    onEmptyClick(
                      col.id,
                      `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                    );
                  }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[var(--brd)]/30 pointer-events-none"
                      style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}
                  {/* 30-min lines */}
                  {HOURS.slice(0, -1).map((h) => (
                    <div
                      key={`half-${h}`}
                      className="absolute w-full border-t border-[var(--brd)]/10 pointer-events-none"
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
                    const canDrag =
                      !rescheduling &&
                      DRAGGABLE_TYPES.includes(ev.type as (typeof DRAGGABLE_TYPES)[number]) &&
                      canEditEvent(ev);
                    const isBeingDragged = draggingEvent?.id === ev.id;

                    return (
                      <div
                        key={ev.id}
                        data-event-card="1"
                        onPointerDown={(e) => {
                          if (!canDrag) return;
                          e.preventDefault();
                          e.stopPropagation();
                          dragRef.current = {
                            event: ev,
                            startX: e.clientX,
                            startY: e.clientY,
                            isDragging: false,
                          };
                        }}
                        className={`absolute left-1 right-1 rounded-md overflow-hidden text-left transition-opacity ${
                          canDrag ? "cursor-grab" : "cursor-pointer"
                        } ${isComplete ? "opacity-50" : ""} ${
                          isBeingDragged ? "opacity-30 pointer-events-none" : ""
                        }`}
                        style={{
                          top,
                          height: Math.max(height, 30),
                          borderLeft: `4px solid ${ev.color}`,
                          background: `linear-gradient(135deg, ${ev.color}25, ${ev.color}10)`,
                          zIndex: isBeingDragged ? 0 : 1,
                        }}
                      >
                        <div className="p-1.5 h-full flex flex-col pointer-events-none">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${isProgress ? "animate-pulse" : ""}`}
                              style={{ backgroundColor: dotColor }}
                            />
                            <span className="text-[11px] font-bold text-[var(--tx)] truncate">
                              {ev.name}
                            </span>
                          </div>
                          <div className="flex items-center text-[9px] text-[var(--tx3)] truncate">
                            <span className="truncate">{ev.description}</span>
                          </div>
                          {height > 60 && ev.truckName && (
                            <div className="text-[8px] text-[var(--tx3)]/60 mt-0.5 truncate">
                              {ev.truckName}
                              {ev.crewName ? ` · ${ev.crewName}` : ""}
                            </div>
                          )}
                          {height > 80 && ev.start && ev.end && (
                            <div className="text-[8px] text-[var(--tx3)]/50 mt-auto">
                              {formatTime12(ev.start)} – {formatTime12(ev.end)}
                            </div>
                          )}
                        </div>
                      </div>
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
              <div className="w-12 sm:w-16 text-right pr-1">
                <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded">
                  NOW
                </span>
              </div>
              <div className="flex-1 h-[2px] bg-red-500/70" />
            </div>
          )}
        </div>
      </div>

      {/* Floating drag preview */}
      {draggingEvent && dragPos && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: dragPos.x + 14, top: dragPos.y - 16 }}
        >
          <div
            className="px-2.5 py-1.5 rounded-md shadow-2xl text-[11px] font-bold max-w-[180px] truncate border"
            style={{
              borderLeft: `4px solid ${draggingEvent.color}`,
              background: `${draggingEvent.color}cc`,
              color: "#fff",
              borderColor: draggingEvent.color,
            }}
          >
            {draggingEvent.name}
            {draggingEvent.start && (
              <span className="ml-1 opacity-70 font-normal">
                {formatTime12(draggingEvent.start)}
              </span>
            )}
          </div>
          {dropCrewId ? (
            <div className="mt-0.5 text-[9px] font-semibold text-green-400 pl-1">
              ↓ Drop to reassign
            </div>
          ) : (
            <div className="mt-0.5 text-[9px] text-[var(--tx3)] pl-1 opacity-60">
              Drag to a team column
            </div>
          )}
        </div>
      )}

      {/* Saving overlay */}
      {rescheduling && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="bg-[var(--card)] border border-[var(--brd)] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-[13px] font-semibold text-[var(--tx)]">
            <div className="w-4 h-4 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            Saving…
          </div>
        </div>
      )}
    </div>
  );
}
