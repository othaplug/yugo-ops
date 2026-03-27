/**
 * App timezone–aware display (defaults America/Toronto).
 * Crons on Vercel run in UTC — offset schedules in vercel.json accordingly.
 */
import { DEFAULT_APP_TIMEZONE, getAppTimezone } from "@/lib/business-timezone";

export const DISPLAY_TIMEZONE = DEFAULT_APP_TIMEZONE;

export function formatDateEt(
  input: string | number | Date | null | undefined,
  style: "date" | "datetime" = "date",
): string {
  if (input === null || input === undefined || input === "") return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const tz = getAppTimezone();
  if (style === "datetime") {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export { formatMoveDate, formatAdminCreatedAt } from "@/lib/date-format";
