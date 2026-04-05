/**
 * Platform-wide date display presets (`platform_config.display_date_format`).
 * Calendar math uses app timezone (`getAppTimezone()`). Client reads `window.__YUGO_DISPLAY_DATE_FORMAT__`.
 *
 * Legacy: if `display_date_format` is empty, `display_date_locale` maps to text presets (en-US → US smart, en-CA → CA smart).
 */

import { getAppTimezone, ymdPartsInTimeZone } from "@/lib/business-timezone";

export const DISPLAY_DATE_FORMAT_CONFIG_KEY = "display_date_format";
/** @deprecated Prefer display_date_format; still read for migration */
export const DISPLAY_DATE_LOCALE_LEGACY_KEY = "display_date_locale";

export const DEFAULT_DISPLAY_DATE_FORMAT_PRESET = "text_mdy_short_us_smart";

type YearMode = "smart" | "always" | "never";
type NumYear = "4" | "2" | "none" | "smart";

type PresetDef =
  | { kind: "text"; locale: "en-US" | "en-CA"; month: "short" | "long"; year: YearMode }
  | { kind: "numeric"; order: "mdy" | "dmy" | "ymd"; sep: string; year: NumYear };

function buildNumericPresets(
  order: "mdy" | "dmy" | "ymd",
  sepKey: string,
  sep: string,
): Record<string, PresetDef> {
  const p = `num_${order}_${sepKey}`;
  return {
    [`${p}_yyyy`]: { kind: "numeric", order, sep, year: "4" },
    [`${p}_yy`]: { kind: "numeric", order, sep, year: "2" },
    [`${p}_no_year`]: { kind: "numeric", order, sep, year: "none" },
    [`${p}_smart_yyyy`]: { kind: "numeric", order, sep, year: "smart" },
  };
}

/** All preset definitions (single source of truth). */
export const DISPLAY_DATE_FORMAT_PRESETS: Record<string, PresetDef> = {
  // ── Text (named month) ─────────────────────────────────────────
  text_mdy_short_us_smart: { kind: "text", locale: "en-US", month: "short", year: "smart" },
  text_mdy_short_us_always: { kind: "text", locale: "en-US", month: "short", year: "always" },
  text_mdy_short_us_never: { kind: "text", locale: "en-US", month: "short", year: "never" },
  text_mdy_short_ca_smart: { kind: "text", locale: "en-CA", month: "short", year: "smart" },
  text_mdy_short_ca_always: { kind: "text", locale: "en-CA", month: "short", year: "always" },
  text_mdy_short_ca_never: { kind: "text", locale: "en-CA", month: "short", year: "never" },
  text_mdy_long_us_smart: { kind: "text", locale: "en-US", month: "long", year: "smart" },
  text_mdy_long_us_always: { kind: "text", locale: "en-US", month: "long", year: "always" },
  text_mdy_long_us_never: { kind: "text", locale: "en-US", month: "long", year: "never" },
  text_mdy_long_ca_smart: { kind: "text", locale: "en-CA", month: "long", year: "smart" },
  text_mdy_long_ca_always: { kind: "text", locale: "en-CA", month: "long", year: "always" },
  text_mdy_long_ca_never: { kind: "text", locale: "en-CA", month: "long", year: "never" },
  // ── MDY numeric MM/DD ────────────────────────────────────────────
  ...buildNumericPresets("mdy", "slash", "/"),
  ...buildNumericPresets("mdy", "dash", "-"),
  ...buildNumericPresets("mdy", "dot", "."),
  // ── DMY numeric DD/MM ────────────────────────────────────────────
  ...buildNumericPresets("dmy", "slash", "/"),
  ...buildNumericPresets("dmy", "dash", "-"),
  ...buildNumericPresets("dmy", "dot", "."),
  // ── YMD numeric ───────────────────────────────────────────────
  ...buildNumericPresets("ymd", "dash", "-"),
  ...buildNumericPresets("ymd", "slash", "/"),
};

/** Grouped labels for Platform Settings <select> (order = UI order). */
export const DISPLAY_DATE_FORMAT_OPTION_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Text — month name (Apr / April)",
    options: [
      { value: "text_mdy_short_us_smart", label: "Apr 8 — show year only when not current year (US)" },
      { value: "text_mdy_short_us_always", label: "Apr 8, 2026 — always show full year (US)" },
      { value: "text_mdy_short_us_never", label: "Apr 8 — never show year" },
      { value: "text_mdy_short_ca_smart", label: "Apr. 8 — smart year (Canada)" },
      { value: "text_mdy_short_ca_always", label: "Apr. 8, 2026 — always year (Canada)" },
      { value: "text_mdy_short_ca_never", label: "Apr. 8 — never year (Canada)" },
      { value: "text_mdy_long_us_smart", label: "April 8 — smart year (US)" },
      { value: "text_mdy_long_us_always", label: "April 8, 2026 — always year (US)" },
      { value: "text_mdy_long_us_never", label: "April 8 — never year (US)" },
      { value: "text_mdy_long_ca_smart", label: "April 8 — smart year (Canada)" },
      { value: "text_mdy_long_ca_always", label: "April 8, 2026 — always year (Canada)" },
      { value: "text_mdy_long_ca_never", label: "April 8 — never year (Canada)" },
    ],
  },
  {
    label: "Numeric — MM/DD (US order)",
    options: [
      { value: "num_mdy_slash_yyyy", label: "MM/DD/YYYY (slash)" },
      { value: "num_mdy_slash_yy", label: "MM/DD/YY (slash)" },
      { value: "num_mdy_slash_no_year", label: "MM/DD — no year (slash)" },
      { value: "num_mdy_slash_smart_yyyy", label: "MM/DD or MM/DD/YYYY — year only if not current (slash)" },
      { value: "num_mdy_dash_yyyy", label: "MM-DD-YYYY" },
      { value: "num_mdy_dash_yy", label: "MM-DD-YY" },
      { value: "num_mdy_dash_no_year", label: "MM-DD — no year" },
      { value: "num_mdy_dash_smart_yyyy", label: "MM-DD or MM-DD-YYYY — smart year" },
      { value: "num_mdy_dot_yyyy", label: "MM.DD.YYYY" },
      { value: "num_mdy_dot_yy", label: "MM.DD.YY" },
      { value: "num_mdy_dot_no_year", label: "MM.DD — no year" },
      { value: "num_mdy_dot_smart_yyyy", label: "MM.DD or MM.DD.YYYY — smart year" },
    ],
  },
  {
    label: "Numeric — DD/MM (day first)",
    options: [
      { value: "num_dmy_slash_yyyy", label: "DD/MM/YYYY (slash)" },
      { value: "num_dmy_slash_yy", label: "DD/MM/YY (slash)" },
      { value: "num_dmy_slash_no_year", label: "DD/MM — no year (slash)" },
      { value: "num_dmy_slash_smart_yyyy", label: "DD/MM or DD/MM/YYYY — smart year (slash)" },
      { value: "num_dmy_dash_yyyy", label: "DD-MM-YYYY" },
      { value: "num_dmy_dash_yy", label: "DD-MM-YY" },
      { value: "num_dmy_dash_no_year", label: "DD-MM — no year" },
      { value: "num_dmy_dash_smart_yyyy", label: "DD-MM or DD-MM-YYYY — smart year" },
      { value: "num_dmy_dot_yyyy", label: "DD.MM.YYYY" },
      { value: "num_dmy_dot_yy", label: "DD.MM.YY" },
      { value: "num_dmy_dot_no_year", label: "DD.MM — no year" },
      { value: "num_dmy_dot_smart_yyyy", label: "DD.MM or DD.MM.YYYY — smart year" },
    ],
  },
  {
    label: "Numeric — YYYY-MM-DD (ISO style)",
    options: [
      { value: "num_ymd_dash_yyyy", label: "YYYY-MM-DD" },
      { value: "num_ymd_dash_yy", label: "YY-MM-DD" },
      { value: "num_ymd_dash_no_year", label: "MM-DD — no year (leading month)" },
      { value: "num_ymd_dash_smart_yyyy", label: "YYYY-MM-DD or MM-DD — smart year" },
      { value: "num_ymd_slash_yyyy", label: "YYYY/MM/DD" },
      { value: "num_ymd_slash_yy", label: "YY/MM/DD" },
      { value: "num_ymd_slash_no_year", label: "MM/DD — no year (leading month)" },
      { value: "num_ymd_slash_smart_yyyy", label: "YYYY/MM/DD or MM/DD — smart year" },
    ],
  },
  {
    label: "Locale numeric (Intl — padding follows locale)",
    options: [
      { value: "intl_mdy_2digit_us", label: "MM/DD/YY — US locale (2-digit year)" },
      { value: "intl_mdy_4digit_us", label: "MM/DD/YYYY — US locale (4-digit year)" },
      { value: "intl_dmy_2digit_gb", label: "DD/MM/YY — UK locale" },
      { value: "intl_dmy_4digit_gb", label: "DD/MM/YYYY — UK locale" },
    ],
  },
];

type IntlNumPreset = { kind: "intl_numeric"; locale: string; y: "2-digit" | "numeric" };

const INTL_NUMERIC_PRESETS: Record<string, IntlNumPreset> = {
  intl_mdy_2digit_us: { kind: "intl_numeric", locale: "en-US", y: "2-digit" },
  intl_mdy_4digit_us: { kind: "intl_numeric", locale: "en-US", y: "numeric" },
  intl_dmy_2digit_gb: { kind: "intl_numeric", locale: "en-GB", y: "2-digit" },
  intl_dmy_4digit_gb: { kind: "intl_numeric", locale: "en-GB", y: "numeric" },
};

const ALLOWED_PRESET = new Set<string>([
  ...Object.keys(DISPLAY_DATE_FORMAT_PRESETS),
  ...Object.keys(INTL_NUMERIC_PRESETS),
]);

export function normalizeDisplayDateFormatPreset(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (ALLOWED_PRESET.has(s)) return s;
  return DEFAULT_DISPLAY_DATE_FORMAT_PRESET;
}

/** Map legacy locale-only config to a text preset. */
export function migrateLocaleToFormatPreset(localeRaw: string | null | undefined): string {
  const loc = String(localeRaw ?? "").trim().toLowerCase();
  if (loc === "en-ca") return "text_mdy_short_ca_smart";
  return "text_mdy_short_us_smart";
}

export function resolveStoredDateFormat(
  formatRaw: string | null | undefined,
  legacyLocaleRaw: string | null | undefined,
): string {
  const trimmed = String(formatRaw ?? "").trim();
  if (trimmed && ALLOWED_PRESET.has(trimmed)) return trimmed;
  return migrateLocaleToFormatPreset(legacyLocaleRaw);
}

declare global {
  interface Window {
    __YUGO_DISPLAY_DATE_FORMAT__?: string;
  }
}

export function getDisplayDateFormatPresetForFormatters(): string {
  if (typeof window !== "undefined" && window.__YUGO_DISPLAY_DATE_FORMAT__) {
    return normalizeDisplayDateFormatPreset(window.__YUGO_DISPLAY_DATE_FORMAT__);
  }
  return DEFAULT_DISPLAY_DATE_FORMAT_PRESET;
}

/** Locale for time-only Intl when date is numeric (en-US is neutral for times). */
export function getIntlLocaleForTimeFromPreset(presetId: string): string {
  const intl = INTL_NUMERIC_PRESETS[presetId];
  if (intl) return intl.locale;
  const def = DISPLAY_DATE_FORMAT_PRESETS[presetId];
  if (def?.kind === "text") return def.locale;
  return "en-US";
}

function calendarPartsInTz(d: Date, tz: string): { y: number; m: number; day: number } {
  const s = ymdPartsInTimeZone(d.getTime(), tz);
  const [ys, ms, ds] = s.split("-");
  return { y: Number(ys), m: Number(ms), day: Number(ds) };
}

function sameYearInTz(d: Date, ref: Date, tz: string): boolean {
  return calendarPartsInTz(d, tz).y === calendarPartsInTz(ref, tz).y;
}

/** Calendar year comparison in the app timezone (for “smart year” rules). */
export function sameCalendarYearInAppTz(d: Date, reference: Date = new Date()): boolean {
  return sameYearInTz(d, reference, getAppTimezone());
}

function formatNumericDate(
  parts: { y: number; m: number; day: number },
  order: "mdy" | "dmy" | "ymd",
  sep: string,
  year: NumYear,
  refY: number,
): string {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.day).padStart(2, "0");
  const y4 = String(parts.y);
  const y2 = y4.slice(-2);

  let showYear: boolean;
  let yStr: string;
  if (year === "none") {
    showYear = false;
    yStr = "";
  } else if (year === "smart") {
    showYear = parts.y !== refY;
    yStr = y4;
  } else if (year === "2") {
    showYear = true;
    yStr = y2;
  } else {
    showYear = true;
    yStr = y4;
  }

  if (order === "mdy") {
    if (!showYear) return `${mm}${sep}${dd}`;
    return `${mm}${sep}${dd}${sep}${yStr}`;
  }
  if (order === "dmy") {
    if (!showYear) return `${dd}${sep}${mm}`;
    return `${dd}${sep}${mm}${sep}${yStr}`;
  }
  // ymd
  if (!showYear) return `${mm}${sep}${dd}`;
  return `${yStr}${sep}${mm}${sep}${dd}`;
}

function formatTextDate(
  d: Date,
  tz: string,
  ref: Date,
  locale: "en-US" | "en-CA",
  month: "short" | "long",
  year: YearMode,
): string {
  if (year === "never") {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, month, day: "numeric" }).format(d);
  }
  const sameY = sameYearInTz(d, ref, tz);
  const includeYear = year === "always" || (year === "smart" && !sameY);
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    month,
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(d);
}

function formatIntlNumeric(d: Date, tz: string, preset: IntlNumPreset): string {
  return new Intl.DateTimeFormat(preset.locale, {
    timeZone: tz,
    year: preset.y,
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Format a single calendar date (date portion only) in app TZ using the platform preset.
 */
export function formatAppDateWithPreset(d: Date, tz: string, ref: Date, presetId: string): string {
  const id = normalizeDisplayDateFormatPreset(presetId);
  const intl = INTL_NUMERIC_PRESETS[id];
  if (intl) return formatIntlNumeric(d, tz, intl);

  const def = DISPLAY_DATE_FORMAT_PRESETS[id];
  if (!def) {
    return formatTextDate(d, tz, ref, "en-US", "short", "smart");
  }
  if (def.kind === "text") {
    return formatTextDate(d, tz, ref, def.locale, def.month, def.year);
  }
  const parts = calendarPartsInTz(d, tz);
  const refY = calendarPartsInTz(ref, tz).y;
  return formatNumericDate(parts, def.order, def.sep, def.year, refY);
}
