import crypto from "crypto";

/** Strip accidental quotes from env pastes */
export function normalizeSlackSigningSecret(secret: string | undefined): string {
  if (!secret) return "";
  return secret.trim().replace(/^["']+|["']+$/g, "");
}

/**
 * Verify Slack request signature (Events API, slash commands).
 * Body must be the exact raw string Slack POSTed (same bytes as used for signing).
 * Compares HMAC digests as bytes (Slack docs: hex-encoded SHA-256).
 */
export function verifySlackRequest(
  signingSecret: string,
  rawBody: string,
  slackSignature: string | null,
  slackTimestamp: string | null
): boolean {
  if (!signingSecret || !slackSignature || !slackTimestamp) return false;
  const ts = Number(slackTimestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 10) return false;

  const sigBase = `v0:${slackTimestamp}:${rawBody}`;
  const ourHex = crypto.createHmac("sha256", signingSecret).update(sigBase).digest("hex");

  const trimmed = slackSignature.trim();
  if (!trimmed.startsWith("v0=")) return false;
  const theirHex = trimmed.slice(3).toLowerCase();
  const ourHexLower = ourHex.toLowerCase();
  if (theirHex.length !== ourHexLower.length || theirHex.length !== 64) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(theirHex, "hex"), Buffer.from(ourHexLower, "hex"));
  } catch {
    return false;
  }
}
