"use client";

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Lock,
  MapPin,
  Palette,
  SquaresFour,
  Stack,
  Truck,
} from "@phosphor-icons/react";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  formatTime12,
  timeToMinutes,
  minutesToTime,
} from "@/lib/calendar/types";
import {
  weekEventBlockStyle,
  calendarPillForeground,
} from "@/lib/calendar/calendar-job-styles";
import { getWeekEventLayouts } from "@/lib/calendar/week-event-layout";
import {
  postBulkShiftMoveProjectDays,
  withDurationEnd,
} from "@/lib/calendar/move-project-bulk-shift";
const HOUR_HEIGHT = 32;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const HOURS = Array.from(
  { length: TOTAL_HOURS + 1 },
  (_, i) => DAY_START_HOUR + i,
);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const DRAG_THRESHOLD = 6;

interface Props {
  anchor: Date;
  todayKey: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (date: string) => void;
  onEventRescheduled?: () => void;
}

function getWeekDays(anchor: Date): { date: Date; key: string }[] {
  const d = new Date(anchor);
  const dow = d.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    return { date: day, key };
  });
}

function getTopOffset(time: string | null): number {
  if (!time) return 2 * HOUR_HEIGHT;
  const mins = timeToMinutes(time);
  return ((mins - DAY_START_HOUR * 60) / 60) * HOUR_HEIGHT;
}

function getHeight(
  start: string | null,
  end: string | null,
  dur: number | null,
): number {
  if (start && end) {
    const diff = timeToMinutes(end) - timeToMinutes(start);
    return Math.max((diff / 60) * HOUR_HEIGHT, 20);
  }
  if (dur) return Math.max(dur * HOUR_HEIGHT, 20);
  return 1.5 * HOUR_HEIGHT;
}

function WeekEventTypeIcon({
  type,
  color,
}: {
  type: CalendarEvent["type"];
  color: string;
}) {
  const common = {
    size: 10,
    weight: "bold" as const,
    className: "shrink-0",
    style: { color } as const,
    "aria-hidden": true as const,
  };
  switch (type) {
    case "move":
      return <MapPin {...common} />;
    case "delivery":
    case "bin_delivery":
    case "bin_pickup":
      return <Truck {...common} />;
    case "project_phase":
      return <Palette {...common} />;
    case "project":
      return <SquaresFour {...common} />;
    case "move_project_day":
      return <Stack {...common} />;
    case "blocked":
      return <Lock {...common} />;
    default:
      return <Stack {...common} />;
  }
}

function canEditWeekEvent(ev: CalendarEvent): boolean {
  if (ev.calendarStatus !== "completed") return true;
  const hasTime = !!(ev.start || ev.end);
  const hasTeam = !!ev.crewId;
  return !hasTime && !hasTeam;
}

function yToTimeFromClientY(clientY: number, rectTop: number): string {
  const y = clientY - rectTop;
  const rawMins = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
  const snapped = Math.round(rawMins / 15) * 15;
  return minutesToTime(
    Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - 15, snapped)),
  );
}

function getCalendarDayDropAtPoint(
  x: number,
  y: number,
): { dayKey: string; rect: DOMRect } | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const col = el.closest("[data-calendar-day]") as HTMLElement | null;
  if (!col) return null;
  const dk = col.dataset.calendarDay;
  if (!dk) return null;
  return { dayKey: dk, rect: col.getBoundingClientRect() };
}

export default function WeekView({
  anchor,
  todayKey,
  eventsByDate,
  onEventClick,
  onDayClick,
  onEventRescheduled,
}: Props) {
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

  const dragRef = useRef<{
    event: CalendarEvent;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const reschedulingRef = useRef(false);
  const suppressDayClickRef = useRef(false);
  const onEventClickRef = useRef(onEventClick);
  onEventClickRef.current = onEventClick;
  const onEventRescheduledRef = useRef(onEventRescheduled);
  onEventRescheduledRef.current = onEventRescheduled;

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragLiveShift, setDragLiveShift] = useState(false);
  const [dropDayKey, setDropDayKey] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  reschedulingRef.current = rescheduling;

  const rescheduleProjectDayWeek = useCallback(
    async (
      ev: CalendarEvent,
      targetDayKey: string,
      newStart: string,
      shiftEntire: boolean,
    ) => {
      const pid = ev.moveProjectId?.trim();
      if (!pid || ev.type !== "move_project_day") return;
      const newEnd = withDurationEnd(
        newStart,
        ev.end,
        ev.durationHours != null && Number.isFinite(ev.durationHours)
          ? ev.durationHours
          : null,
      );
      const crewId = ev.crewId?.trim() || null;
      const crewPayload = crewId ? [crewId] : [];

      setRescheduling(true);
      try {
        if (shiftEntire) {
          const merged = await postBulkShiftMoveProjectDays({
            projectId: pid,
            anchorDayId: ev.id,
            targetDate: targetDayKey,
            startTime: newStart,
            endTime: newEnd,
            crewId,
            shiftEntireProject: true,
            syncTimeAndCrewToAll: false,
          });
          if (merged.ok) onEventRescheduledRef.current?.();
          else alert(merged.error);
        } else {
          const res = await fetch(
            `/api/admin/move-projects/${pid}/days/${ev.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                crew_ids: crewPayload,
                date: targetDayKey,
                start_time: newStart,
                end_time: newEnd,
              }),
            },
          );
          if (res.ok) {
            onEventRescheduledRef.current?.();
          } else {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(data.error || "Failed to reschedule");
          }
        }
      } catch {
        alert("Network error while rescheduling");
      } finally {
        setRescheduling(false);
      }
    },
    [],
  );

  useEffect(() => {
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
      setDragLiveShift(e.shiftKey);
      setDragPos({ x: e.clientX, y: e.clientY });
      const hit = getCalendarDayDropAtPoint(e.clientX, e.clientY);
      setDropDayKey(hit?.dayKey ?? null);
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;
      setDraggingEvent(null);
      setDragPos(null);
      setDragLiveShift(false);
      setDropDayKey(null);

      if (!d.isDragging) {
        onEventClickRef.current(d.event);
        return;
      }
      if (reschedulingRef.current) return;
      if (d.event.type !== "move_project_day") return;

      const hit = getCalendarDayDropAtPoint(e.clientX, e.clientY);
      if (!hit) return;
      const newStart = yToTimeFromClientY(e.clientY, hit.rect.top);
      const shiftEntire = e.shiftKey;
      suppressDayClickRef.current = true;
      void rescheduleProjectDayWeek(
        d.event,
        hit.dayKey,
        newStart,
        shiftEntire,
      );
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [rescheduleProjectDayWeek]);

  const utilization = useMemo(() => {
    const result: Record<string, { booked: number; total: number }> = {};
    for (const { key } of weekDays) {
      const dayEvents = eventsByDate[key] || [];
      let bookedMins = 0;
      for (const ev of dayEvents) {
        if (ev.start && ev.end) {
          bookedMins += timeToMinutes(ev.end) - timeToMinutes(ev.start);
        } else if (ev.durationHours) {
          bookedMins += ev.durationHours * 60;
        } else {
          bookedMins += 90;
        }
      }
      result[key] = { booked: bookedMins, total: TOTAL_HOURS * 60 };
    }
    return result;
  }, [weekDays, eventsByDate]);

  const hasUnscheduled = weekDays.some(({ key }) =>
    (eventsByDate[key] || []).some((ev) => !ev.start),
  );

  const weekLayouts = useMemo(() => {
    const m: Record<string, ReturnType<typeof getWeekEventLayouts>> = {};
    for (const { key } of weekDays) {
      const list = (eventsByDate[key] || []).filter((ev) => ev.start);
      m[key] = getWeekEventLayouts(list);
    }
    return m;
  }, [weekDays, eventsByDate]);

  return (
    <div
      className={`px-2 sm:px-4 pb-3 ${draggingEvent ? "select-none" : ""}`}
    >
      {/* Horizontal scroll wrapper, all rows scroll together on mobile */}
      <div className="overflow-x-auto">
        {/* Day headers */}
        <div className="flex border-b border-[var(--brd)]">
          <div className="w-10 sm:w-14 shrink-0" />
          {weekDays.map(({ date, key }, i) => {
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onDayClick(key)}
                className={`flex-1 min-w-[44px] py-2 text-center border-l border-[var(--brd)] hover:bg-[var(--bg)]/50 transition-colors ${
                  isToday ? "bg-blue-500/[0.06]" : ""
                }`}
              >
                <div
                  className={`text-[9px] font-bold tracking-wider uppercase mb-0.5 ${
                    isToday
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-[var(--tx3)]"
                  }`}
                >
                  {DAY_NAMES[i]}
                </div>
                <div className="flex items-center justify-center">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                      isToday
                        ? "bg-blue-600 text-[#F9EDE4]"
                        : "text-[var(--tx2)] hover:text-blue-500 dark:hover:text-blue-400"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* All-day / Unscheduled strip */}
        {hasUnscheduled && (
          <div className="flex border-b border-[var(--brd)] bg-[var(--bg)]/40">
            <div className="w-10 sm:w-14 shrink-0 py-1 flex items-center justify-end pr-1">
              <span className="text-[7px] font-semibold text-[var(--tx3)]/82 uppercase tracking-wide hidden sm:block">
                All-day
              </span>
            </div>
            {weekDays.map(({ key }) => {
              const untimedEvents = (eventsByDate[key] || []).filter(
                (ev) => !ev.start,
              );
              return (
                <div
                  key={key}
                  className="flex-1 min-w-[44px] border-l border-[var(--brd)] py-1 px-0.5 flex flex-col gap-0.5 min-h-[28px]"
                >
                  {untimedEvents.map((ev) => {
                    const w = weekEventBlockStyle(ev);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        className="w-full text-left rounded-md px-2 py-1 text-[10px] sm:text-[11px] font-semibold leading-snug line-clamp-2 break-words border border-black/[0.04] dark:border-white/[0.06] hover:brightness-[1.01] transition-all"
                        style={w.container}
                      >
                        <span
                          className="line-clamp-2"
                          style={{ color: w.titleColor }}
                        >
                          {ev.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline */}
        <div className="overflow-y-auto max-h-[calc(100vh-230px)] sm:max-h-[calc(100vh-250px)]">
          <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
            {/* Time labels */}
            <div className="w-10 sm:w-14 shrink-0 relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full text-right pr-1 sm:pr-1.5 text-[8px] sm:text-[9px] text-[var(--tx3)] font-medium"
                  style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 5 }}
                >
                  {h <= 12 ? `${h}AM` : `${h - 12}PM`}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(({ key }) => {
              const dayEvents = (eventsByDate[key] || []).filter(
                (ev) => ev.start,
              );
              const isToday = key === todayKey;
              const layoutById = weekLayouts[key]!;

              return (
                <div
                  key={key}
                  data-calendar-day={key}
                  className={`flex-1 min-w-[44px] relative border-l border-[var(--brd)] ${isToday ? "bg-blue-500/[0.04]" : ""}`}
                  onClick={() => {
                    if (suppressDayClickRef.current) {
                      suppressDayClickRef.current = false;
                      return;
                    }
                    onDayClick(key);
                  }}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-[var(--brd)]/20"
                      style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }}
                    />
                  ))}

                  {dayEvents.map((ev) => {
                    const top = getTopOffset(ev.start);
                    const height = getHeight(
                      ev.start,
                      ev.end,
                      ev.durationHours,
                    );
                    const block = weekEventBlockStyle(ev);
                    const hPos = layoutById.get(ev.id) ?? {
                      leftPct: 0,
                      widthPct: 100,
                      columnIndex: 0,
                      columnCount: 1,
                    };
                    const cancelled = ev.calendarStatus === "cancelled";
                    const inProgress = ev.calendarStatus === "in_progress";
                    const canDrag =
                      !rescheduling &&
                      ev.type === "move_project_day" &&
                      !!ev.moveProjectId?.trim() &&
                      canEditWeekEvent(ev);
                    const isBeingDragged = draggingEvent?.id === ev.id;
                    const posStyle = {
                      top,
                      height: Math.max(height, 20),
                      left:
                        hPos.widthPct < 100
                          ? `calc(2px + (100% - 4px) * ${(hPos.leftPct / 100).toFixed(4)})`
                          : "2px",
                      width:
                        hPos.widthPct < 100
                          ? `calc((100% - 4px) * ${(hPos.widthPct / 100).toFixed(4)})`
                          : "calc(100% - 4px)",
                      zIndex: 5 + hPos.columnIndex,
                      borderRadius: 6,
                      ...block.container,
                    };
                    const chromeClass = `absolute overflow-hidden text-left transition-all ${
                      inProgress
                        ? "ring-1 ring-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]"
                        : "hover:brightness-[1.015]"
                    } ${cancelled ? "line-through" : ""}`;
                    const inner = (
                      <>
                        <div className="px-1.5 pt-1 pb-0.5 min-h-0 flex flex-col items-stretch text-left min-w-0 pointer-events-none">
                          <div className="flex items-center gap-0.5 min-w-0">
                            {ev.start && (
                              <span
                                className="text-[9px] sm:text-[10px] font-bold shrink-0 tabular-nums leading-none"
                                style={{ color: block.timeColor }}
                              >
                                {formatTime12(ev.start)}
                              </span>
                            )}
                            <WeekEventTypeIcon
                              type={ev.type}
                              color={block.timeColor}
                            />
                          </div>
                          <span
                            className={`mt-0.5 min-w-0 w-full text-[10px] sm:text-[11px] font-semibold leading-snug ${
                              height > 32 ? "line-clamp-2" : "truncate"
                            }`}
                            style={{ color: block.titleColor }}
                          >
                            {ev.name}
                          </span>
                        </div>
                        {height > 30 && ev.description ? (
                          <div
                            className="px-1.5 pb-1 text-[9px] sm:text-[10px] leading-snug pointer-events-none"
                            style={{ color: block.subtleColor }}
                          >
                            <span className="line-clamp-1">
                              {ev.description}
                            </span>
                          </div>
                        ) : null}
                      </>
                    );

                    if (canDrag) {
                      return (
                        <div
                          key={ev.id}
                          role="button"
                          tabIndex={0}
                          data-event-card="1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              onEventClick(ev);
                            }
                          }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dragRef.current = {
                              event: ev,
                              startX: e.clientX,
                              startY: e.clientY,
                              isDragging: false,
                            };
                          }}
                          className={`${chromeClass} cursor-grab active:cursor-grabbing ${
                            isBeingDragged
                              ? "opacity-35 pointer-events-none"
                              : ""
                          }`}
                          style={posStyle}
                        >
                          {inner}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={ev.id}
                        type="button"
                        data-event-card="1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        className={`${chromeClass} cursor-pointer`}
                        style={posStyle}
                      >
                        {inner}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Utilization bars */}
        <div className="flex border-t border-[var(--brd)] mt-0">
          <div className="w-10 sm:w-14 shrink-0 py-2 text-right pr-1 sm:pr-1.5 text-[8px] text-[var(--tx3)] font-semibold">
            Util.
          </div>
          {weekDays.map(({ key }) => {
            const u = utilization[key] || { booked: 0, total: 840 };
            const pct = Math.min(Math.round((u.booked / u.total) * 100), 100);
            const barColor =
              pct < 70 ? "#22C55E" : pct < 90 ? "#F59E0B" : "#EF4444";
            const hrs = Math.round((u.booked / 60) * 10) / 10;

            return (
              <div
                key={key}
                className="flex-1 min-w-[44px] border-l border-[var(--brd)] px-0.5 sm:px-1 py-1.5"
              >
                <div className="h-1.5 rounded-full bg-[var(--brd)]/30 overflow-hidden mb-0.5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="text-[7px] text-[var(--tx3)] text-center hidden sm:block">
                  {hrs}h ({pct}%)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {draggingEvent && dragPos && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: dragPos.x + 14, top: dragPos.y - 16 }}
        >
          <div
            className="px-2.5 py-1.5 rounded-md text-[11px] font-bold max-w-[200px] truncate border"
            style={{
              borderLeft: `4px solid ${draggingEvent.color}`,
              background: `${draggingEvent.color}cc`,
              color: calendarPillForeground(draggingEvent).main,
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
          <div className="mt-0.5 text-[9px] pl-1">
            {dropDayKey ? (
              <span className="font-semibold text-green-500 dark:text-green-400">
                Drop on day to reschedule
              </span>
            ) : (
              <span className="text-[var(--tx3)] opacity-60">
                {draggingEvent.type === "move_project_day" && dragLiveShift
                  ? "Shift: shift every project day together"
                  : draggingEvent.type === "move_project_day"
                    ? "Shift+drop: all days · drop: this day only"
                    : ""}
              </span>
            )}
          </div>
        </div>
      )}

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
