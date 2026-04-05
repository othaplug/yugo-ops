/**
 * App timezone–aware display (defaults America/Toronto).
 * Crons on Vercel run in UTC — offset schedules in vercel.json accordingly.
 */
import { DEFAULT_APP_TIMEZONE, getAppTimezone } from "@/lib/business-timezone";
import {
  formatAppDateWithPreset,
  getDisplayDateFormatPresetForFormatters,
  getIntlLocaleForTimeFromPreset,
} from "@/lib/display-date-format";

export const DISPLAY_TIMEZONE = DEFAULT_APP_TIMEZONE;

export function formatDateEt(
  input: string | number | Date | null | undefined,
  style: "date" | "datetime" = "date",
): string {
  if (input === null || input === undefined || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const tz = getAppTimezone();
  const preset = getDisplayDateFormatPresetForFormatters();
  const datePart = formatAppDateWithPreset(d, tz, new Date(), preset);
  if (style === "datetime") {
    const loc = getIntlLocaleForTimeFromPreset(preset);
    const timePart = new Intl.DateTimeFormat(loc, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
    return `${datePart}, ${timePart}`;
  }
  return datePart;
}

export { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
