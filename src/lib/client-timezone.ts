/**
 * Client-side timezone helpers.
 * All date/time display should use APP_TZ so crew, admin, and partner
 * dashboards show consistent times regardless of browser locale.
 */

const APP_TZ =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_TIMEZONE) ||
  "America/Toronto";

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: APP_TZ, ...options });
}

export function formatTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { timeZone: APP_TZ, ...options });
}

export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { timeZone: APP_TZ, ...options });
}

export { APP_TZ };
