import "server-only";
import { createSign } from "crypto";

const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GCAL_BASE = "https://www.googleapis.com/calendar/v3";

/* ── Token cache (module-level, reused across requests in the same process) ── */
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
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
  const sig = base64url(sign.sign(privateKey));
  return `${header}.${payload}.${sig}`;
}

export async function getGCalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;

  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY;
  if (!clientEmail || !rawKey) {
    throw new Error("GOOGLE_CALENDAR_CLIENT_EMAIL or GOOGLE_CALENDAR_PRIVATE_KEY not configured");
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
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
  return !!(
    process.env.GOOGLE_CALENDAR_CLIENT_EMAIL &&
    process.env.GOOGLE_CALENDAR_PRIVATE_KEY &&
    process.env.GOOGLE_CALENDAR_ID
  );
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
