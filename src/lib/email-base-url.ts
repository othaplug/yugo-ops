/**
 * Base URL for track links, emails, and webhooks (must be your public app domain).
 * Prefer NEXT_PUBLIC_APP_URL in production (e.g. https://opsplus.co or https://app.opsplus.co).
 * NEXT_PUBLIC_EMAIL_APP_URL overrides for email links only if you need a different sending-domain URL.
 */
export function getEmailBaseUrl(): string {
  const url =
    (process.env.NEXT_PUBLIC_EMAIL_APP_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
    "https://opsplus.co";
  return url.replace(/\/$/, "");
}
