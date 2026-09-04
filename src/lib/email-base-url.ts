/**
 * Base URL for track links, emails, and webhooks (must be your public app domain).
 * Prefer NEXT_PUBLIC_APP_URL in production (e.g. https://helloyugo.com or https://app.helloyugo.com).
 * NEXT_PUBLIC_EMAIL_APP_URL overrides for email links only if you need a different sending-domain URL.
 *
 * CANONICAL DEFAULT: `https://www.yugoplus.co`, NOT the apex. The Vercel
 * project serves the apex with a 307 → www redirect, and many integrations
 * (Square webhooks, Stripe webhooks, etc.) do NOT follow redirects on
 * POSTs — so any time a server-to-server caller hit the apex URL, the
 * request got dropped silently. Defaulting to www end-to-end keeps every
 * outbound link aimed at a URL that responds with 200, not 307.
 */
/**
 * Durable guard against the legacy `opsplus.co` domain leaking into any
 * customer-facing link. opsplus.co is the old brand host; it 308-redirects to
 * www.yugoplus.co, but links must never SHOW it. Any opsplus host (or a bare
 * apex) is rewritten to the canonical www.yugoplus.co regardless of the env,
 * so a stale env var can never leak the wrong brand again.
 */
export function canonicalizeAppUrl(raw: string): string {
  let url = (raw || "").trim().replace(/\/$/, "");
  if (!url) return "https://www.yugoplus.co";
  url = url.replace(/^(https?:\/\/)(?:www\.)?opsplus\.co/i, "https://www.yugoplus.co");
  url = url.replace(/^(https?:\/\/)yugoplus\.co/i, "https://www.yugoplus.co");
  return url;
}

export function getEmailBaseUrl(): string {
  const url =
    (process.env.NEXT_PUBLIC_EMAIL_APP_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL || "").trim() ||
    "https://www.yugoplus.co";
  return canonicalizeAppUrl(url);
}
