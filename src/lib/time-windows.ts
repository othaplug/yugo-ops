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
