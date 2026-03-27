/**
 * Base URL for track links, emails, and webhooks (must be your public app domain).
 * Prefer NEXT_PUBLIC_APP_URL in production (e.g. https://helloyugo.com or https://app.helloyugo.com).
 * NEXT_PUBLIC_EMAIL_APP_URL overrides for email links only if you need a different sending-domain URL.
 *
 * Important for review links: this URL must be the exact origin where the Next app (and proxy) run.
 * If emails point at a different host than the app, set NEXT_PUBLIC_EMAIL_APP_URL to the app origin
 * so tracked links hit the same app and don’t get 401.
 */
export function getEmailBaseUrl(): string {
  const url =
    (process.env.NEXT_PUBLIC_EMAIL_APP_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
    "https://helloyugo.com";
  return url.replace(/\/$/, "");
}
