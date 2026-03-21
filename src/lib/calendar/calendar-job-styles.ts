import type { CSSProperties } from "react";
import type { CalendarEvent } from "./types";

/** Dark text on bright pills (Google Calendar–style legibility). */
export const CALENDAR_PILL_TEXT = "#0f172a";
export const CALENDAR_PILL_TEXT_MUTED = "#334155";

/** Status dot on bright pills — darker ink so it stays visible on yellow/sky fills. */
export function pillStatusDotColor(calendarStatus: string): string {
  const map: Record<string, string> = {
    scheduled: "#1D4ED8",
    in_progress: "#B45309",
    completed: "#15803D",
    cancelled: "#991B1B",
    rescheduled: "#6D28D9",
  };
  return map[calendarStatus] ?? map.scheduled;
}

export function jobPillSurfaceStyle(ev: CalendarEvent): CSSProperties {
  const cancelled = ev.calendarStatus === "cancelled";
  const completed = ev.calendarStatus === "completed";

  if (cancelled) {
    return {
      backgroundColor: "transparent",
      color: "rgba(248, 250, 252, 0.92)",
      border: `2px dashed ${ev.color}`,
      boxShadow: "none",
    };
  }

  return {
    backgroundColor: ev.color,
    color: CALENDAR_PILL_TEXT,
    borderLeft: `4px solid rgba(15, 23, 42, 0.35)`,
    opacity: completed ? 0.72 : 1,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
  };
}

export function jobPillCompactStyle(ev: CalendarEvent): CSSProperties {
  const cancelled = ev.calendarStatus === "cancelled";
  const completed = ev.calendarStatus === "completed";
  if (cancelled) {
    return {
      backgroundColor: "transparent",
      color: "rgba(248, 250, 252, 0.9)",
      border: `1.5px dashed ${ev.color}`,
    };
  }
  return {
    backgroundColor: ev.color,
    color: CALENDAR_PILL_TEXT,
    borderLeft: `3px solid rgba(15, 23, 42, 0.3)`,
    opacity: completed ? 0.7 : 1,
  };
}
