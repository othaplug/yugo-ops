"use client";

import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, JOB_COLORS, STATUS_DOT_COLORS } from "@/lib/calendar/types";

interface Props {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: CalendarEvent) => void;
  onDragStart?: (e: CalendarEvent) => void;
}

const TYPE_ICONS: Record<string, string> = {
  move: "🚚",
  delivery: "📦",
  project_phase: "🎨",
  blocked: "🚫",
};

export default function JobCard({ event, compact, onClick, onDragStart }: Props) {
  const dotColor = STATUS_DOT_COLORS[event.calendarStatus] || STATUS_DOT_COLORS.scheduled;
  const isCompleted = event.calendarStatus === "completed";
  const isCancelled = event.calendarStatus === "cancelled";
  const isInProgress = event.calendarStatus === "in_progress";

  const timeStr = event.start
    ? event.end
      ? `${formatTime12(event.start).replace(/ /g, "")}-${formatTime12(event.end).replace(/ /g, "")}`
      : formatTime12(event.start)
    : null;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(event)}
        draggable={!!onDragStart}
        onDragStart={() => onDragStart?.(event)}
        className={`w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] truncate transition-colors cursor-pointer hover:brightness-125 ${
          isCompleted ? "opacity-50" : ""
        } ${isCancelled ? "line-through opacity-40" : ""}`}
        style={{ borderLeft: `2px solid ${event.color}`, background: `${event.color}15` }}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${isInProgress ? "animate-pulse" : ""}`}
          style={{ backgroundColor: dotColor }}
        />
        <span className="truncate text-[var(--tx)]">
          {timeStr && <span className="text-[var(--tx3)] mr-1">{timeStr}</span>}
          {event.name}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      draggable={!!onDragStart}
      onDragStart={() => onDragStart?.(event)}
      className={`w-full text-left p-2 rounded-lg transition-all cursor-pointer hover:brightness-110 ${
        isCompleted ? "opacity-50" : ""
      } ${isCancelled ? "opacity-40" : ""}`}
      style={{ borderLeft: `3px solid ${event.color}`, background: `${event.color}12` }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isInProgress ? "animate-pulse" : ""}`}
          style={{ backgroundColor: dotColor }}
        />
        {timeStr && (
          <span className="text-[10px] text-[var(--tx3)] font-medium">{timeStr}</span>
        )}
        <span className="text-[8px] text-[var(--tx3)]/50">·</span>
        <span className={`text-[11px] font-bold text-[var(--tx)] truncate ${isCancelled ? "line-through" : ""}`}>
          {event.name}
        </span>
      </div>
      <div className="flex items-center gap-1 text-[9px] text-[var(--tx3)] pl-3.5">
        <span>{TYPE_ICONS[event.type] || ""}</span>
        <span className="truncate">{event.description}</span>
        {event.crewName && (
          <>
            <span>·</span>
            <span className="truncate">{event.crewName}</span>
          </>
        )}
      </div>
    </button>
  );
}
