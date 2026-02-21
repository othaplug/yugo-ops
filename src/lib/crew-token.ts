import { createHmac, timingSafeEqual } from "crypto";

const CREW_SECRET_ENV = "CREW_SESSION_SECRET";
const DEV_SECRET = "dev-crew-secret-change-in-production";

export function getCrewSessionSecret(): string {
  const secret = process.env[CREW_SECRET_ENV];
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim() === "" || secret === DEV_SECRET) {
      throw new Error(
        `${CREW_SECRET_ENV} must be set in production (min 32 chars). Add it to .env.local and restart. Run: npm run generate-crew-secret`
      );
    }
    return secret.trim();
  }
  return secret?.trim() || DEV_SECRET;
}

/** Hash PIN for storage/comparison. Uses CREW_SESSION_SECRET. */
export function hashCrewPin(pin: string): string {
  return createHmac("sha256", getCrewSessionSecret()).update(pin).digest("hex");
}
/** Short session: one shift. Re-PIN at start of shift is fine. Optional 2FA (e.g. code to phone) can be added later for sensitive actions. */
const EXPIRY_HOURS = 12;

/** Crew PIN length (6 digits for slightly better entropy, still easy to tap). */
export const CREW_PIN_LENGTH = 6;

function getSecret(): string {
  return getCrewSessionSecret();
}

export interface CrewTokenPayload {
  crewMemberId: string;
  teamId: string;
  role: string;
  name: string;
  exp: number;
}

export function signCrewToken(payload: Omit<CrewTokenPayload, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_HOURS * 3600;
  const data = JSON.stringify({ ...payload, exp });
  const sig = createHmac("sha256", getSecret()).update(data).digest("base64url");
  return Buffer.from(data, "utf8").toString("base64url") + "." + sig;
}

export function verifyCrewToken(token: string): CrewTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const data = Buffer.from(parts[0], "base64url").toString("utf8");
    const expectedSig = createHmac("sha256", getSecret()).update(data).digest("base64url");
    if (!timingSafeEqual(Buffer.from(parts[1], "utf8"), Buffer.from(expectedSig, "utf8"))) return null;
    const parsed = JSON.parse(data) as CrewTokenPayload;
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const CREW_COOKIE_NAME = "yugo-crew-session";
