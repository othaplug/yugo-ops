/**
 * Verbose server logs (API traces, success breadcrumbs). In production, no-ops unless
 * DEBUG_SERVER_LOGS=1 or DEBUG_SERVER_LOGS=true (e.g. temporary ops debugging).
 *
 * Use for noisy logs. Keep console.error for real failures; keep PRICING_DEBUG / feature
 * flags as their own explicit branches where needed.
 */
export function serverDebug(...args: unknown[]): void {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEBUG_SERVER_LOGS !== "1" &&
    process.env.DEBUG_SERVER_LOGS !== "true"
  ) {
    return;
  }
  console.log(...args);
}
