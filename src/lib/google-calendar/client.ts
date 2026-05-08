import "server-only";
import { createSign, createPrivateKey } from "crypto";

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

/* ── Token cache (module-level, reused across requests in the same process) ── */
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * Resolve the service account credentials, supporting all common env var formats:
 *
 * 1. Standard split vars (preferred):
 *    - GOOGLE_CALENDAR_CLIENT_EMAIL = "x@y.iam.gserviceaccount.com"
 *    - GOOGLE_CALENDAR_PRIVATE_KEY  = PEM with literal \n escapes
 *
 * 2. JSON service account in GOOGLE_CALENDAR_PRIVATE_KEY (paste-the-json case):
 *    - GOOGLE_CALENDAR_PRIVATE_KEY = '{"type":"service_account","client_email":"...","private_key":"..."}'
 *
 * 3. Base64-encoded JSON service account (recommended for Vercel env vars to avoid escaping):
 *    - GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64 = base64(<service-account.json>)
 */
function resolveCredentials(): { clientEmail: string; privateKey: string } {
  const b64 = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64?.trim();
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as {
        client_email?: string;
        private_key?: string;
      };
      if (json.client_email && json.private_key) {
        return { clientEmail: json.client_email, privateKey: json.private_key };
      }
    } catch {
      throw new Error("GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64 is not valid base64-encoded JSON");
    }
  }

  const rawKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY?.trim();
  let clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL?.trim() ?? "";

  if (!rawKey) {
    throw new Error("GOOGLE_CALENDAR_PRIVATE_KEY (or GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64) is not configured");
  }

  // If the env var is the full JSON service account
  if (rawKey.startsWith("{")) {
    try {
      const json = JSON.parse(rawKey) as { client_email?: string; private_key?: string };
      if (json.private_key) {
        if (!clientEmail && json.client_email) clientEmail = json.client_email;
        if (!clientEmail) {
          throw new Error("GOOGLE_CALENDAR_CLIENT_EMAIL is not configured");
        }
        return { clientEmail, privateKey: json.private_key };
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("CLIENT_EMAIL")) throw err;
      throw new Error("GOOGLE_CALENDAR_PRIVATE_KEY looks like JSON but failed to parse");
    }
  }

  // Auto-detect: if value has no PEM headers but looks like base64-encoded JSON or
  // base64-encoded PEM, decode it transparently. This is the most common cause of
  // "Private key is missing PEM headers" errors — users paste base64 into the wrong
  // env var.
  if (!rawKey.includes("BEGIN ") && /^[A-Za-z0-9+/=\s]+$/.test(rawKey)) {
    try {
      const decoded = Buffer.from(rawKey, "base64").toString("utf8");
      // Decoded JSON service account
      if (decoded.trim().startsWith("{")) {
        const json = JSON.parse(decoded) as {
          client_email?: string;
          private_key?: string;
        };
        if (json.private_key) {
          if (!clientEmail && json.client_email) clientEmail = json.client_email;
          if (!clientEmail) {
            throw new Error("GOOGLE_CALENDAR_CLIENT_EMAIL is not configured");
          }
          return { clientEmail, privateKey: json.private_key };
        }
      }
      // Decoded raw PEM
      if (decoded.includes("BEGIN ") && decoded.includes("PRIVATE KEY")) {
        if (!clientEmail) {
          throw new Error("GOOGLE_CALENDAR_CLIENT_EMAIL is not configured");
        }
        return { clientEmail, privateKey: decoded };
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("CLIENT_EMAIL")) throw err;
      // fall through to the PEM path below — error there is more accurate
    }
  }

  if (!clientEmail) {
    throw new Error("GOOGLE_CALENDAR_CLIENT_EMAIL is not configured");
  }

  return { clientEmail, privateKey: rawKey };
}

/**
 * Canonicalize a PEM private key for OpenSSL 3.x compatibility.
 *
 * OpenSSL 3.x (Node.js 18+) is strict about RFC 7468 PEM format:
 * - No trailing spaces, no Windows-style \r\n, exactly 64 base64 chars per line.
 *
 * This handles every common env var encoding seen in the wild:
 * - Literal "\n" escapes (Vercel single-line storage)
 * - JSON-double-escaped "\\n"
 * - Surrounding double or single quotes
 * - Stray BOM, NBSP, or zero-width chars from copy/paste
 * - Mixed line endings (\r\n)
 * - Headers with extra whitespace or wrong line wrapping
 */
function normalizePemKey(rawKey: string): string {
  let key = rawKey;

  // 1. Strip surrounding quotes (a common copy/paste issue)
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  // 2. Strip BOM and zero-width chars
  key = key.replace(/^﻿/, "").replace(/[​-‍⁠]/g, "");

  // 3. Replace NBSP with regular space, normalize line endings
  key = key.replace(/ /g, " ").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 4. Convert escaped newlines (handle both single and double-escaped)
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n");

  const headerMatch = key.match(/-----BEGIN ([A-Z0-9 ]+)-----/);
  const footerMatch = key.match(/-----END ([A-Z0-9 ]+)-----/);
  if (!headerMatch || !footerMatch) {
    throw new Error(
      "Private key is missing PEM headers (expected '-----BEGIN PRIVATE KEY-----'). " +
        "Easiest fix: in your terminal run `base64 -i service-account.json | pbcopy` " +
        "and paste the result into GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64 (preferred). " +
        "Or paste the raw PEM with literal \\n escapes into GOOGLE_CALENDAR_PRIVATE_KEY.",
    );
  }

  const keyType = headerMatch[1].trim();

  // Strip all whitespace from the base64 body then re-wrap at exactly 64 chars
  const base64 = key
    .replace(/-----BEGIN [A-Z0-9 ]+-----/, "")
    .replace(/-----END [A-Z0-9 ]+-----/, "")
    .replace(/\s+/g, "");

  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    throw new Error("Private key body contains non-base64 characters after normalization");
  }

  const wrapped = (base64.match(/.{1,64}/g) ?? []).join("\n");
  return `-----BEGIN ${keyType}-----\n${wrapped}\n-----END ${keyType}-----\n`;
}

function buildJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: clientEmail,
        scope: GCAL_SCOPE,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  // Use explicit KeyObject so OpenSSL 3.x accepts PKCS8 ("BEGIN PRIVATE KEY") keys.
  let keyObj;
  try {
    keyObj = createPrivateKey({ key: Buffer.from(privateKey, "utf8"), format: "pem" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not decode Google Calendar private key. ${msg}. ` +
        "Tip: in Vercel, paste the JSON service account file and base64-encode it into GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64 to avoid escaping issues.",
    );
  }
  const sig = base64url(sign.sign(keyObj));
  return `${header}.${payload}.${sig}`;
}

export async function getGCalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const { clientEmail, privateKey: rawKey } = resolveCredentials();
  const privateKey = normalizePemKey(rawKey);
  const jwt = buildJwt(clientEmail, privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token error ${res.status}: ${body}`);
  }

  const { access_token, expires_in } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = access_token;
  tokenExpiresAt = Date.now() + (expires_in ?? 3600) * 1000;
  return access_token;
}

export function getGCalId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID not configured");
  return id;
}

export function isGCalConfigured(): boolean {
  if (!process.env.GOOGLE_CALENDAR_ID) return false;
  if (process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_B64) return true;
  return !!(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL && process.env.GOOGLE_CALENDAR_PRIVATE_KEY);
}

type GCalMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function callGCal<T = unknown>(
  path: string,
  method: GCalMethod = "GET",
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const token = await getGCalAccessToken();
  const url = path.startsWith("http") ? path : `${GCAL_BASE}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return { ok: true, status: 204, data: null };

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, status: res.status, data: null, error: msg };
  }
  return { ok: true, status: res.status, data: data as T };
}
