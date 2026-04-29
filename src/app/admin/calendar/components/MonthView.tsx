"use client";

import type { DragEvent } from "react";
import { useCallback, useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  postBulkShiftMoveProjectDays,
  withDurationEnd,
} from "@/lib/calendar/move-project-bulk-shift";
import JobCard from "./JobCard";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const MONTH_MOVE_PROJECT_DRAG =
  "application/x-yugo-move-project-day";

type MonthMoveProjectDragPayload = {
  v: 1;
  dayId: string;
  projectId: string;
  sourceDateKey: string;
  start: string | null;
  end: string | null;
  durationHours: number | null;
  crewId: string | null;
};

interface Props {
  year: number;
  month: number;
  todayKey: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  onEventClick: (e: CalendarEvent) => void;
  onDateClick: (date: string) => void;
  onNewClick: (date: string) => void;
  onEventRescheduled?: () => void;
}

function getMonthCells(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const adjusted = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < adjusted; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function canDragRescheduleMoveProjectDay(ev: CalendarEvent): boolean {
  if (ev.type !== "move_project_day") return false;
  if (!ev.moveProjectId?.trim()) return false;
  if (ev.calendarStatus !== "completed") return true;
  const hasTime = !!(ev.start || ev.end);
  const hasTeam = !!ev.crewId;
  return !hasTime && !hasTeam;
}

export default function MonthView({
  year,
  month,
  todayKey,
  eventsByDate,
  onEventClick,
  onDateClick,
  onNewClick,
  onEventRescheduled,
}: Props) {
  const cells = getMonthCells(year, month);
  const onEventRescheduledRef = useRef(onEventRescheduled);
  onEventRescheduledRef.current = onEventRescheduled;
  const suppressNextCellClickRef = useRef(false);
  const [rescheduling, setRescheduling] = useState(false);

  const handleProjectDayDragStart = useCallback(
    (e: DragEvent<HTMLButtonElement>, ev: CalendarEvent, sourceDateKey: string) => {
      if (!canDragRescheduleMoveProjectDay(ev)) return;
      const pid = ev.moveProjectId?.trim();
      if (!pid) return;
      e.stopPropagation();
      const payload: MonthMoveProjectDragPayload = {
        v: 1,
        dayId: ev.id,
        projectId: pid,
        sourceDateKey,
        start: ev.start ?? null,
        end: ev.end ?? null,
        durationHours:
          ev.durationHours != null && Number.isFinite(ev.durationHours)
            ? ev.durationHours
            : null,
        crewId: ev.crewId?.trim() || null,
      };
      e.dataTransfer.setData(MONTH_MOVE_PROJECT_DRAG, JSON.stringify(payload));
      e.dataTransfer.setData("text/plain", ev.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDayDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>, targetDateKey: string) => {
      e.preventDefault();
      e.stopPropagation();
      const raw = e.dataTransfer.getData(MONTH_MOVE_PROJECT_DRAG);
      if (!raw) return;
      let payload: MonthMoveProjectDragPayload;
      try {
        payload = JSON.parse(raw) as MonthMoveProjectDragPayload;
      } catch {
        return;
      }
      if (payload.v !== 1 || !payload.dayId || !payload.projectId) return;
      if (payload.sourceDateKey === targetDateKey) return;

      const shiftEntire = e.shiftKey;
      const hasTime = !!(payload.start && String(payload.start).trim());
      const crewPayload = payload.crewId ? [payload.crewId] : [];

      suppressNextCellClickRef.current = true;
      setRescheduling(true);
      try {
        if (shiftEntire) {
          const newEnd =
            hasTime && payload.start
              ? withDurationEnd(
                  payload.start,
                  payload.end,
                  payload.durationHours,
                )
              : null;
          const merged = await postBulkShiftMoveProjectDays({
            projectId: payload.projectId,
            anchorDayId: payload.dayId,
            targetDate: targetDateKey,
            ...(hasTime && payload.start && newEnd
              ? {
                  startTime: payload.start,
                  endTime: newEnd,
                  crewId: payload.crewId,
                }
              : { crewId: payload.crewId }),
            shiftEntireProject: true,
            syncTimeAndCrewToAll: false,
          });
          if (merged.ok) onEventRescheduledRef.current?.();
          else alert(merged.error);
        } else if (hasTime && payload.start) {
          const newEnd = withDurationEnd(
            payload.start,
            payload.end,
            payload.durationHours,
          );
          const res = await fetch(
            `/api/admin/move-projects/${payload.projectId}/days/${payload.dayId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                crew_ids: crewPayload,
                date: targetDateKey,
                start_time: payload.start,
                end_time: newEnd,
              }),
            },
          );
          if (res.ok) onEventRescheduledRef.current?.();
          else {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            alert(data.error || "Failed to reschedule");
          }
        } else {
          const res = await fetch(
            `/api/admin/move-projects/${payload.projectId}/days/${payload.dayId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                crewPayload.length
                  ? { crew_ids: crewPayload, date: targetDateKey }
                  : { date: targetDateKey },
              ),
            },
          );
          if (res.ok) onEventRescheduledRef.current?.();
          else {
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

  return (
    <div className="relative px-3 sm:px-4 pb-3">
      <p className="text-[10px] text-[var(--tx3)] mb-2 px-0.5 leading-snug">
        Drag a multi-day move strip to another date. Hold Shift while dropping
        to shift the whole project by the same number of calendar days.
      </p>
      <div className="grid grid-cols-7 gap-px bg-[var(--brd)]/35 dark:bg-zinc-600/40 overflow-hidden rounded-xl">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="bg-[var(--bg)] py-2 text-center text-[10px] font-bold tracking-[0.14em] uppercase text-[#64748B] dark:text-[#94A3B8]"
          >
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null)
            return (
              <div key={`e-${i}`} className="bg-[var(--bg)] min-h-[72px]" />
            );
          const dk = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDate[dk] || [];
          const isToday = dk === todayKey;
          const hasEvents = dayEvents.length > 0;
          const MAX_VISIBLE = 3;

          return (
            <div
              key={dk}
              data-calendar-month-day={dk}
              onDragOver={(e) => {
                const types = Array.from(e.dataTransfer.types);
                if (!types.includes(MONTH_MOVE_PROJECT_DRAG)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = e.shiftKey ? "copy" : "move";
              }}
              onDrop={(e) => void handleDayDrop(e, dk)}
              onClick={() => {
                if (suppressNextCellClickRef.current) {
                  suppressNextCellClickRef.current = false;
                  return;
                }
                if (hasEvents) onDateClick(dk);
                else onNewClick(dk);
              }}
              className={`min-h-[84px] p-1.5 transition-all cursor-pointer ${
                isToday
                  ? "bg-blue-500/[0.08] dark:bg-blue-500/10 border border-blue-500/25"
                  : "bg-[var(--bg)] hover:bg-[var(--card)]"
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(dk);
                  }}
                  className="flex items-center"
                >
                  <span
                    className={`inline-flex items-center justify-center text-[11px] font-bold transition-colors ${
                      isToday
                        ? "w-7 h-7 rounded-full bg-blue-600 text-white shadow-md"
                        : "text-[var(--tx2)] hover:text-blue-500 dark:hover:text-blue-400"
                    }`}
                  >
                    {day}
                  </span>
                </button>
                {hasEvents && (
                  <span className="text-[7px] text-[var(--tx3)]/40 font-medium">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                  <JobCard
                    key={ev.id}
                    event={ev}
                    compact
                    onClick={onEventClick}
                    onDragStart={
                      canDragRescheduleMoveProjectDay(ev)
                        ? (de) => handleProjectDayDragStart(de, ev, dk)
                        : undefined
                    }
                  />
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => onDateClick(dk)}
                    className="text-[8px] text-[var(--accent-text)] hover:text-[var(--accent-text)] font-semibold pl-1 transition-colors"
                  >
                    +{dayEvents.length - MAX_VISIBLE} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
