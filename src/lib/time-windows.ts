/**
 * Arrival / delivery windows (2-hour, premium feel).
 * Optional override: platform_config key `arrival_window_options` = JSON string array of labels.
 */
export const DEFAULT_TIME_WINDOW_LABELS = [
  "Early Morning (6:00 AM – 8:00 AM)",
  "Morning (8:00 AM – 10:00 AM)",
  "Late Morning (10:00 AM – 12:00 PM)",
  "Early Afternoon (12:00 PM – 2:00 PM)",
  "Afternoon (2:00 PM – 4:00 PM)",
  "Late Afternoon (4:00 PM – 6:00 PM)",
  "Evening (6:00 PM – 8:00 PM)",
] as const;

/** Stored value === label (human-readable on quotes and crew apps). */
export const TIME_WINDOW_OPTIONS: string[] = [...DEFAULT_TIME_WINDOW_LABELS];

/**
 * B2B partner bookings: strict 2-hour arrival windows (stored as full label on delivery_window / time_slot).
 */
export const B2B_PARTNER_TIME_WINDOW_LABELS = [
  "Early (7:00 AM – 9:00 AM)",
  "Morning (9:00 AM – 11:00 AM)",
  "Late Morning (11:00 AM – 1:00 PM)",
  "Midday (1:00 PM – 3:00 PM)",
  "Afternoon (3:00 PM – 5:00 PM)",
  "Late Afternoon (5:00 PM – 7:00 PM)",
  "Evening (7:00 PM – 9:00 PM)",
] as const;

export const B2B_PARTNER_TIME_WINDOW_OPTIONS: string[] = [...B2B_PARTNER_TIME_WINDOW_LABELS];

/** Legacy recurring / day-rate keys before 2-hour partner windows. */
const LEGACY_PARTNER_TIME_WINDOW_LABELS: Record<string, string> = {
  morning: "Morning (8am – 12pm)",
  afternoon: "Afternoon (12pm – 5pm)",
  evening: "Evening (5pm – 8pm)",
  flexible: "Flexible",
  full_day: "Full day (8am – 5pm)",
};

/** Select options so existing schedules with legacy `time_window` values still edit cleanly. */
export const LEGACY_PARTNER_RECURRING_TIME_WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: "morning", label: "Morning (8am – 12pm) — legacy" },
  { value: "afternoon", label: "Afternoon (12pm – 5pm) — legacy" },
  { value: "evening", label: "Evening (5pm – 8pm) — legacy" },
  { value: "flexible", label: "Flexible — legacy" },
  { value: "full_day", label: "Full day (8am – 5pm) — legacy" },
];

export function formatPartnerRecurringTimeWindow(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const v = String(value).trim();
  return LEGACY_PARTNER_TIME_WINDOW_LABELS[v] ?? v;
}

function amPmTokenTo24(h: number, min: string, ap: string): string {
  let hr = h;
  const A = ap.toUpperCase();
  if (A === "PM" && hr !== 12) hr += 12;
  if (A === "AM" && hr === 12) hr = 0;
  return `${String(hr).padStart(2, "0")}:${min}`;
}

/** First clock time in a label, e.g. "Early (7:00 AM – 9:00 AM)" → "07:00". */
export function parsePartnerWindowLabelStartHHMM(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const m = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  return amPmTokenTo24(parseInt(m[1], 10), m[2], m[3]);
}

/** Second clock time in a label (end of window). */
export function parsePartnerWindowLabelEndHHMM(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  const matches = [...label.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  if (matches.length < 2) return null;
  const last = matches[matches.length - 1];
  return amPmTokenTo24(parseInt(last[1], 10), last[2], last[3]);
}

export function parseTimeWindowOptionsFromConfig(json: string | undefined | null): string[] {
  if (!json || !json.trim()) return TIME_WINDOW_OPTIONS;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string" && x.trim())) {
      return parsed as string[];
    }
  } catch {
    /* ignore */
  }
  return TIME_WINDOW_OPTIONS;
}
