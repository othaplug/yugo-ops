"use client";

import { useMemo } from "react";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, timeToMinutes, STATUS_DOT_COLORS } from "@/lib/calendar/types";
import { Icon } from "@/components/AppIcons";

const HOUR_HEIGHT = 40;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 20;
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface Props {
  anchor: Date;
  todayKey: string;
  eventsByDate: Record<string, CalendarEvent[]>;
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (date: string) => void;
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

function getHeight(start: string | null, end: string | null, dur: number | null): number {
  if (start && end) {
    const diff = timeToMinutes(end) - timeToMinutes(start);
    return Math.max((diff / 60) * HOUR_HEIGHT, 20);
  }
  if (dur) return Math.max(dur * HOUR_HEIGHT, 20);
  return 1.5 * HOUR_HEIGHT;
}

const TYPE_ICON_MAP: Record<string, string> = { move: "truck", delivery: "package", project_phase: "palette", project: "projects", blocked: "lock" };

export default function WeekView({ anchor, todayKey, eventsByDate, onEventClick, onDayClick }: Props) {
  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);

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

  return (
    <div className="px-6 pb-6">
      {/* Day headers */}
      <div className="flex border-b border-[var(--brd)]">
        <div className="w-14 shrink-0" />
        {weekDays.map(({ date, key }, i) => {
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(key)}
              className={`flex-1 min-w-0 py-2 text-center border-l border-[var(--brd)] hover:bg-[var(--bg)]/50 transition-colors ${
                isToday ? "bg-[var(--gold)]/5" : ""
              }`}
            >
              <div className={`text-[9px] font-bold tracking-wider uppercase ${isToday ? "text-[var(--gold)]" : "text-[var(--tx3)]/50"}`}>
                {DAY_NAMES[i]} {date.getDate()}
              </div>
              {isToday && <span className="text-[7px] bg-[var(--gold)]/20 text-[var(--gold)] px-1 py-px rounded font-bold">Today</span>}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full text-right pr-1.5 text-[9px] text-[var(--tx3)] font-medium"
                style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT - 5 }}
              >
                {h <= 12 ? `${h}AM` : `${h - 12}PM`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(({ key }) => {
            const dayEvents = eventsByDate[key] || [];
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`flex-1 min-w-0 relative border-l border-[var(--brd)] ${isToday ? "bg-[var(--gold)]/3" : ""}`}
                onClick={() => onDayClick(key)}
              >
                {HOURS.map((h) => (
                  <div key={h} className="absolute w-full border-t border-[var(--brd)]/20" style={{ top: (h - DAY_START_HOUR) * HOUR_HEIGHT }} />
                ))}

                {dayEvents.map((ev) => {
                  const top = getTopOffset(ev.start);
                  const height = getHeight(ev.start, ev.end, ev.durationHours);
                  const dotColor = STATUS_DOT_COLORS[ev.calendarStatus] || STATUS_DOT_COLORS.scheduled;

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="absolute left-0.5 right-0.5 rounded overflow-hidden text-left hover:brightness-110 cursor-pointer transition-all"
                      style={{
                        top,
                        height: Math.max(height, 20),
                        borderLeft: `3px solid ${ev.color}`,
                        background: `${ev.color}25`,
                      }}
                    >
                      <div className="p-0.5 flex items-center gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.calendarStatus === "in_progress" ? "animate-pulse" : ""}`} style={{ backgroundColor: dotColor }} />
                        <span className="text-[8px] font-bold text-[var(--tx)] truncate">{ev.name}</span>
                      </div>
                      {height > 25 && (
                        <div className="flex items-center gap-0.5 text-[7px] text-[var(--tx3)] truncate px-0.5">
                          <Icon name={TYPE_ICON_MAP[ev.type] || "calendar"} className="w-2.5 h-2.5 shrink-0 stroke-[1.75] stroke-current" />
                          <span className="truncate">{ev.description}</span>
                        </div>
                      )}
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
        <div className="w-14 shrink-0 py-2 text-right pr-1.5 text-[8px] text-[var(--tx3)] font-semibold">Util.</div>
        {weekDays.map(({ key }) => {
          const u = utilization[key] || { booked: 0, total: 840 };
          const pct = Math.min(Math.round((u.booked / u.total) * 100), 100);
          const barColor = pct < 70 ? "#22C55E" : pct < 90 ? "#F59E0B" : "#EF4444";
          const hrs = Math.round((u.booked / 60) * 10) / 10;

          return (
            <div key={key} className="flex-1 min-w-0 border-l border-[var(--brd)] px-1 py-1.5">
              <div className="h-1.5 rounded-full bg-[var(--brd)]/30 overflow-hidden mb-0.5">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
              <div className="text-[7px] text-[var(--tx3)] text-center">{hrs}h ({pct}%)</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
