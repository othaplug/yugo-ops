/**
 * Base URL for track links, emails, and webhooks (must be your public app domain).
 * Prefer NEXT_PUBLIC_APP_URL in production (e.g. https://opsplus.co or https://app.opsplus.co).
 * NEXT_PUBLIC_EMAIL_APP_URL overrides for email links only if you need a different sending-domain URL.
 *
 * Important for review links: this URL must be the exact origin where the Next app (and proxy) run.
 * If emails point at a different host (e.g. opsplus.co) than the app (e.g. app.opsplus.co), set
 * NEXT_PUBLIC_EMAIL_APP_URL to the app origin so star links hit the same app and don’t get 401.
 */
export function getEmailBaseUrl(): string {
  const url =
    (process.env.NEXT_PUBLIC_EMAIL_APP_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
    "https://opsplus.co";
  return url.replace(/\/$/, "");
}
