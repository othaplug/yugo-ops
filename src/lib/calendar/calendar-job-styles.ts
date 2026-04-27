import type { CSSProperties } from "react";
import type { CalendarEvent } from "./types";

/** Wine move / partner-style pill on admin calendar */
export const CALENDAR_WINE_MOVE_FILL = "#8B1A3A";
/** Property management (contract) moves on admin calendar */
export const CALENDAR_PM_MOVE_FILL = "#6D28D9";
/** B2B delivery — wine rose (replaces bright pink; light ink for contrast). */
export const CALENDAR_B2B_DELIVERY_FILL = "#7A2848";
export const CALENDAR_WINE_PILL_TEXT = "#F9EDE4";
export const CALENDAR_WINE_PILL_TEXT_MUTED = "rgba(249, 237, 228, 0.72)";

/** Dark text on bright pills (non-wine job types). */
export const CALENDAR_PILL_TEXT = "#0f172a";
export const CALENDAR_PILL_TEXT_MUTED = "#334155";

export function calendarPillUsesLightInk(ev: CalendarEvent): boolean {
  const c = ev.color.toLowerCase();
  return (
    c === CALENDAR_WINE_MOVE_FILL.toLowerCase() ||
    c === CALENDAR_B2B_DELIVERY_FILL.toLowerCase() ||
    c === CALENDAR_PM_MOVE_FILL.toLowerCase() ||
    ev.type === "move"
  );
}

/** Partner / list UIs that only have a background hex (no full `CalendarEvent`). */
export function calendarPillTextForBackground(backgroundHex: string): string {
  if (backgroundHex.toLowerCase() === CALENDAR_WINE_MOVE_FILL.toLowerCase()) {
    return CALENDAR_WINE_PILL_TEXT;
  }
  return CALENDAR_PILL_TEXT;
}

export function calendarPillForeground(ev: CalendarEvent): {
  main: string;
  muted: string;
} {
  if (calendarPillUsesLightInk(ev)) {
    return {
      main: CALENDAR_WINE_PILL_TEXT,
      muted: CALENDAR_WINE_PILL_TEXT_MUTED,
    };
  }
  return { main: CALENDAR_PILL_TEXT, muted: CALENDAR_PILL_TEXT_MUTED };
}

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
  const lightInk = calendarPillUsesLightInk(ev);

  if (cancelled) {
    return {
      backgroundColor: "transparent",
      color: "rgba(249, 237, 228, 0.92)",
      border: `2px dashed ${ev.color}`,
      boxShadow: "none",
    };
  }

  return {
    backgroundColor: ev.color,
    color: lightInk ? CALENDAR_WINE_PILL_TEXT : CALENDAR_PILL_TEXT,
    borderLeft: lightInk
      ? `4px solid rgba(249, 237, 228, 0.35)`
      : `4px solid rgba(15, 23, 42, 0.35)`,
    opacity: completed ? 0.72 : 1,
    boxShadow: "none",
  };
}

/**
 * GCal-style week blocks: light tinted fill, saturated left border, dark accent ink.
 * Works with admin v3 cream canvas; keeps move/delivery type hues from `ev.color`.
 */
export function weekEventBlockStyle(ev: CalendarEvent): {
  container: CSSProperties;
  timeColor: string;
  titleColor: string;
  subtleColor: string;
} {
  const cancelled = ev.calendarStatus === "cancelled";
  const completed = ev.calendarStatus === "completed";
  const accent = ev.color;

  if (cancelled) {
    return {
      container: {
        backgroundColor: "color-mix(in srgb, var(--brd) 30%, var(--card))",
        borderLeft: `3px solid ${accent}`,
        color: "var(--tx2)",
        opacity: 0.9,
        boxShadow: "none",
      },
      timeColor: "var(--tx2)",
      titleColor: "var(--tx2)",
      subtleColor: "var(--tx3)",
    };
  }

  const fill = `color-mix(in srgb, ${accent} 16%, #ffffff)`;
  return {
    container: {
      backgroundColor: fill,
      borderLeft: `3px solid ${accent}`,
      color: "var(--tx)",
      boxShadow: "0 1px 0 rgba(26, 20, 16, 0.05)",
      opacity: completed ? 0.78 : 1,
    },
    timeColor: accent,
    titleColor: "color-mix(in srgb, #1a1410 78%, " + accent + ")",
    subtleColor: "color-mix(in srgb, #605750 80%, " + accent + ")",
  };
}

export function jobPillCompactStyle(ev: CalendarEvent): CSSProperties {
  const cancelled = ev.calendarStatus === "cancelled";
  const completed = ev.calendarStatus === "completed";
  const lightInk = calendarPillUsesLightInk(ev);
  if (cancelled) {
    return {
      backgroundColor: "transparent",
      color: "rgba(249, 237, 228, 0.9)",
      border: `1.5px dashed ${ev.color}`,
    };
  }
  return {
    backgroundColor: ev.color,
    color: lightInk ? CALENDAR_WINE_PILL_TEXT : CALENDAR_PILL_TEXT,
    borderLeft: lightInk
      ? `3px solid rgba(249, 237, 228, 0.3)`
      : `3px solid rgba(15, 23, 42, 0.3)`,
    opacity: completed ? 0.7 : 1,
  };
}

/** Small tags on calendar pills (RECURRING, phase) — wine admin: no heavy shadows. */
export function calendarPillTagStyle(ev: CalendarEvent): CSSProperties {
  const lightInk = calendarPillUsesLightInk(ev);
  if (lightInk) {
    return {
      backgroundColor: "rgba(249, 237, 228, 0.12)",
      color: CALENDAR_WINE_PILL_TEXT,
      borderRadius: 4,
      fontSize: 11,
      padding: "1px 8px",
      fontFamily: "var(--font-body)",
    };
  }
  return {
    backgroundColor: "rgba(15, 23, 42, 0.15)",
    color: CALENDAR_PILL_TEXT,
    borderRadius: 4,
    fontSize: 11,
    padding: "1px 8px",
    fontFamily: "var(--font-body)",
  };
}
