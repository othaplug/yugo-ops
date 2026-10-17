import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Verify a HubSpot webhook request signature.
 *
 * HubSpot signs requests with the app's client secret in one of three formats
 * (https://developers.hubspot.com/docs/api/webhooks/validating-requests):
 *
 *   v1  X-HubSpot-Signature (version header "v1")
 *       hex( SHA-256( clientSecret + requestBody ) )
 *   v2  X-HubSpot-Signature (version header "v2")
 *       hex( SHA-256( clientSecret + method + uri + requestBody ) )
 *   v3  X-HubSpot-Signature-v3 + X-HubSpot-Request-Timestamp
 *       base64( HMAC-SHA256( clientSecret, method + uri + requestBody + timestamp ) )
 *       Rejected when the timestamp is more than 5 minutes old. The URI is signed
 *       with the listed percent-encodings decoded (decodeV3Uri).
 *
 * v1 and v2 are plain hashes, not HMACs. Every comparison is constant-time.
 * There is no "skip when unset" path: callers must reject the request when
 * the secret is missing.
 */

export const HUBSPOT_V3_MAX_AGE_MS = 5 * 60 * 1000;

export type HubSpotSignatureResult =
  | { valid: true; version: "v1" | "v2" | "v3" }
  | { valid: false; reason: string };

export interface HubSpotSignatureInput {
  secret: string;
  method: string;
  /** Every URL the request may have been signed against (public URL first). */
  uris: readonly string[];
  rawBody: string;
  headers: { get(name: string): string | null };
  nowMs?: number;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** v3 signs the URI with these percent-encodings decoded (HubSpot docs). */
const V3_DECODE: Record<string, string> = {
  "%3A": ":", "%2F": "/", "%3F": "?", "%40": "@", "%21": "!", "%24": "$",
  "%27": "'", "%28": "(", "%29": ")", "%2A": "*", "%2C": ",", "%3B": ";",
};

export function decodeV3Uri(uri: string): string {
  return uri.replace(/%(3A|2F|3F|40|21|24|27|28|29|2A|2C|3B)/gi, (m) => V3_DECODE[m.toUpperCase()] ?? m);
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function verifyHubSpotSignature(input: HubSpotSignatureInput): HubSpotSignatureResult {
  const secret = input.secret.trim();
  if (!secret) return { valid: false, reason: "secret_not_configured" };

  const method = input.method.toUpperCase();
  const uris = [...new Set(input.uris.filter(Boolean))];
  const v3 = input.headers.get("x-hubspot-signature-v3");

  if (v3) {
    const ts = input.headers.get("x-hubspot-request-timestamp") ?? "";
    const tsMs = Number(ts);
    const now = input.nowMs ?? Date.now();
    if (!Number.isFinite(tsMs) || tsMs <= 0) return { valid: false, reason: "v3_missing_timestamp" };
    if (Math.abs(now - tsMs) > HUBSPOT_V3_MAX_AGE_MS) return { valid: false, reason: "v3_timestamp_too_old" };
    for (const uri of new Set(uris.map(decodeV3Uri))) {
      const expected = createHmac("sha256", secret)
        .update(method + uri + input.rawBody + ts, "utf8")
        .digest("base64");
      if (safeEqual(expected, v3)) return { valid: true, version: "v3" };
    }
    return { valid: false, reason: "v3_mismatch" };
  }

  const sig = (input.headers.get("x-hubspot-signature") ?? "").trim().toLowerCase();
  if (!sig) return { valid: false, reason: "missing_signature" };
  const version = (input.headers.get("x-hubspot-signature-version") ?? "v1").trim().toLowerCase();

  if (version === "v1") {
    return safeEqual(sha256Hex(secret + input.rawBody), sig)
      ? { valid: true, version: "v1" }
      : { valid: false, reason: "v1_mismatch" };
  }
  if (version === "v2") {
    for (const uri of uris) {
      if (safeEqual(sha256Hex(secret + method + uri + input.rawBody), sig)) {
        return { valid: true, version: "v2" };
      }
    }
    return { valid: false, reason: "v2_mismatch" };
  }
  return { valid: false, reason: `unsupported_version_${version}` };
}

/**
 * Candidate URIs HubSpot may have signed: the URL as received, and the
 * public URL rebuilt from forwarded headers (Vercel proxies the request).
 */
export function hubSpotSignedUris(req: { url: string; headers: { get(name: string): string | null } }): string[] {
  const out: string[] = [];
  if (req.url) out.push(req.url);
  try {
    const u = new URL(req.url);
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
    if (host) out.unshift(`${proto}://${host}${u.pathname}${u.search}`);
  } catch {
    // Relative or malformed URL: only the raw value is tried.
  }
  return [...new Set(out)];
}
