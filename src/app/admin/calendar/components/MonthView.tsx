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
    <div className="px-3 sm:px-4 pb-3">
      <div className="grid grid-cols-7 gap-px bg-[var(--brd)]/40 overflow-hidden rounded-lg">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-[var(--bg)] py-1.5 text-center text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} className="bg-[var(--bg)] min-h-[72px]" />;
          const dk = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDate[dk] || [];
          const isToday = dk === todayKey;
          const hasEvents = dayEvents.length > 0;
          const MAX_VISIBLE = 3;

          return (
            <div
              key={dk}
              onClick={() => hasEvents ? onDateClick(dk) : onNewClick(dk)}
              className={`min-h-[72px] p-1 transition-all cursor-pointer ${
                isToday
                  ? "bg-[var(--gold)]/[0.07] border border-[var(--gold)]/30"
                  : "bg-[var(--bg)] hover:bg-[var(--card)]"
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDateClick(dk); }}
                  className="flex items-center"
                >
                  <span
                    className={`inline-flex items-center justify-center text-[11px] font-bold transition-colors ${
                      isToday
                        ? "w-6 h-6 rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                        : "text-[var(--tx2)] hover:text-[var(--gold)]"
                    }`}
                  >
                    {day}
                  </span>
                </button>
                {hasEvents && (
                  <span className="text-[7px] text-[var(--tx3)]/40 font-medium">{dayEvents.length}</span>
                )}
              </div>
              <div className="space-y-px" onClick={(e) => e.stopPropagation()}>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
