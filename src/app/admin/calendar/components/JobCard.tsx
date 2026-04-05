"use client";

import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12 } from "@/lib/calendar/types";
import {
  calendarPillForeground,
  calendarPillTagStyle,
  calendarPillUsesLightInk,
  jobPillCompactStyle,
  jobPillSurfaceStyle,
  pillStatusDotColor,
} from "@/lib/calendar/calendar-job-styles";
import { toTitleCase } from "@/lib/format-text";

interface Props {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: CalendarEvent) => void;
  onDragStart?: (e: CalendarEvent) => void;
}

export default function JobCard({ event, compact, onClick, onDragStart }: Props) {
  const dotColor = pillStatusDotColor(event.calendarStatus);
  const isCompleted = event.calendarStatus === "completed";
  const isCancelled = event.calendarStatus === "cancelled";
  const isInProgress = event.calendarStatus === "in_progress";
  const lightInk = calendarPillUsesLightInk(event);
  const fg = calendarPillForeground(event);
  const tagStyle = calendarPillTagStyle(event);

  const timeStr = event.start
    ? event.end
      ? `${formatTime12(event.start).replace(/ /g, "")}-${formatTime12(event.end).replace(/ /g, "")}`
      : formatTime12(event.start)
    : null;

  const compactStyle = jobPillCompactStyle(event);
  const surfaceStyle = jobPillSurfaceStyle(event);

  const dotRing = lightInk ? "ring-white/15" : "ring-black/10";

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(event)}
        draggable={!!onDragStart}
        onDragStart={() => onDragStart?.(event)}
        className={`w-full text-left flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] truncate transition-all cursor-pointer hover:brightness-[1.02] active:scale-[0.99] ${
          isCompleted ? "opacity-80" : ""
        } ${isCancelled ? "line-through" : ""}`}
        style={compactStyle}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ring-1 ${dotRing} ${isInProgress ? "animate-pulse" : ""}`}
          style={{ backgroundColor: isCancelled ? "rgba(249,237,228,0.8)" : dotColor }}
        />
        <span
          className="truncate font-semibold"
          style={{ color: isCancelled ? "inherit" : fg.main }}
        >
          {timeStr && (
            <span
              className="mr-1 font-medium"
              style={{ color: isCancelled ? "rgba(249,237,228,0.75)" : fg.muted }}
            >
              {timeStr}
            </span>
          )}
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
      className={`w-full text-left p-2.5 rounded-lg transition-all cursor-pointer hover:brightness-[1.02] active:scale-[0.99] ${
        isCompleted ? "opacity-75" : ""
      } ${isCancelled ? "opacity-90" : ""}`}
      style={surfaceStyle}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ring-1 ${dotRing} ${isInProgress ? "animate-pulse" : ""}`}
          style={{ backgroundColor: isCancelled ? "rgba(249,237,228,0.85)" : dotColor }}
        />
        {timeStr && (
          <span
            className="text-[10px] font-semibold"
            style={{ color: isCancelled ? "rgba(249,237,228,0.85)" : fg.muted }}
          >
            {timeStr}
          </span>
        )}
        <span className="text-[8px] opacity-50" style={{ color: isCancelled ? "inherit" : fg.main }}>
          ·
        </span>
        <span
          className={`text-[12px] font-bold truncate flex-1 min-w-0 ${isCancelled ? "line-through" : ""}`}
          style={{ color: isCancelled ? "inherit" : fg.main }}
        >
          {event.name}
        </span>
        {event.isRecurring && (
          <span className="ml-auto shrink-0 text-[8px] font-bold uppercase" style={tagStyle}>
            RECURRING
          </span>
        )}
      </div>
      <div
        className="flex items-center gap-1 text-[10px] truncate"
        style={{ color: isCancelled ? "rgba(249,237,228,0.8)" : fg.muted }}
      >
        <span className="truncate">{toTitleCase(event.description)}</span>
        {event.eventPhase && (
          <span className="shrink-0 font-bold uppercase" style={tagStyle}>
            {event.eventPhase === "delivery"
              ? "Deliver"
              : event.eventPhase === "return"
                ? "Return"
                : event.eventPhase}
          </span>
        )}
        {event.crewName && (
          <>
            <span style={{ color: isCancelled ? "inherit" : fg.main }}>·</span>
            <span className="truncate">{event.crewName}</span>
          </>
        )}
      </div>
    </button>
  );
}
