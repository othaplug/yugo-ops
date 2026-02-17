/**
 * Base URL used for all links in outgoing emails.
 * Set NEXT_PUBLIC_EMAIL_APP_URL to a URL on your sending domain (e.g. https://app.opsplus.co)
 * so Resend's "Link URLs match sending domain" check passes and deliverability is better.
 */
export function getEmailBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_EMAIL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://yugo-ops.vercel.app"
  ).replace(/\/$/, "");
}
