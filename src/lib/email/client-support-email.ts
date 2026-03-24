const DEFAULT_CLIENT_SUPPORT_EMAIL = "support@helloyugo.com";

/**
 * Human support inbox for client-facing copy (notifications From is no-reply).
 * Set `CLIENT_SUPPORT_EMAIL` in env to override; defaults to support@helloyugo.com.
 */
export function getClientSupportEmail(): string {
  const v =
    typeof process !== "undefined" ? process.env.CLIENT_SUPPORT_EMAIL?.trim() : "";
  return v || DEFAULT_CLIENT_SUPPORT_EMAIL;
}

export function clientSupportMailtoHref(): string {
  return `mailto:${encodeURIComponent(getClientSupportEmail())}`;
}
