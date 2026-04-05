/**
 * Legacy `platform_config.display_date_locale` (en-US / en-CA) is migrated into
 * `display_date_format` presets. Intl **locale** for time-only formatters is derived from the
 * active preset via `getIntlLocaleForTimeFromPreset` (see `display-date-format.ts`).
 *
 * This module stays free of DB imports for client bundles.
 */

import {
  getDisplayDateFormatPresetForFormatters,
  getIntlLocaleForTimeFromPreset,
} from "@/lib/display-date-format";

export const DISPLAY_DATE_LOCALE_CONFIG_KEY = "display_date_locale";

export const DISPLAY_DATE_LOCALE_OPTIONS = [
  { value: "en-US", label: "United States (e.g. Apr 8, 2026)" },
  { value: "en-CA", label: "Canada (e.g. Apr. 8, 2026)" },
] as const;

export type DisplayDateLocale = (typeof DISPLAY_DATE_LOCALE_OPTIONS)[number]["value"];

const ALLOWED = new Set<string>(DISPLAY_DATE_LOCALE_OPTIONS.map((o) => o.value));

/** Normalize legacy locale values (still used if old API or config rows reference them). */
export function normalizeDisplayDateLocale(raw: string | null | undefined): DisplayDateLocale {
  const s = String(raw ?? "").trim();
  if (ALLOWED.has(s)) return s as DisplayDateLocale;
  return "en-US";
}

/**
 * BCP 47 locale for `Intl` time (and escape-hatch date) formatters — follows the active
 * **display date format** preset (US/CA text presets, or en-US/en-GB for intl-numeric presets).
 */
export function getDisplayDateLocaleForFormatters(): string {
  return getIntlLocaleForTimeFromPreset(getDisplayDateFormatPresetForFormatters());
}
