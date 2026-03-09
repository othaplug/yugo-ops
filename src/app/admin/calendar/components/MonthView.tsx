"use client";

import type { CalendarEvent } from "@/lib/calendar/types";
import JobCard from "./JobCard";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface Props {
  year: number;
  month: number;
  todayKey: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  onEventClick: (e: CalendarEvent) => void;
  onDateClick: (date: string) => void;
  onNewClick: (date: string) => void;
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

export default function MonthView({ year, month, todayKey, eventsByDate, onEventClick, onDateClick, onNewClick }: Props) {
  const cells = getMonthCells(year, month);

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-7 gap-px bg-[var(--brd)] overflow-hidden rounded-lg">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-[var(--bg)] py-2.5 text-center text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-[var(--card)] min-h-[110px]" />;
          const dk = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDate[dk] || [];
          const isToday = dk === todayKey;
          const MAX_VISIBLE = 4;

          return (
            <div
              key={dk}
              className={`bg-[var(--card)] min-h-[110px] p-1.5 transition-colors hover:bg-[var(--bg)]/80 ${
                isToday ? "ring-2 ring-inset ring-[var(--gold)]/50" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <button
                  type="button"
                  onClick={() => onDateClick(dk)}
                  className={`text-[12px] font-semibold hover:text-[var(--gold)] transition-colors ${
                    isToday ? "text-[var(--gold)] font-bold" : "text-[var(--tx)]"
                  }`}
                >
                  {day}
                </button>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map((ev) => (
                  <JobCard key={ev.id} event={ev} compact onClick={onEventClick} />
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <button
                    type="button"
                    onClick={() => onDateClick(dk)}
                    className="text-[8px] text-[var(--gold)] hover:text-[var(--gold2)] font-semibold pl-1 transition-colors"
                  >
                    +{dayEvents.length - MAX_VISIBLE} more
                  </button>
                )}
                {dayEvents.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onNewClick(dk)}
                    className="text-[9px] text-[var(--tx3)]/30 hover:text-[var(--gold)] transition-colors"
                  >
                    + New
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
