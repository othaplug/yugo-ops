import { createHmac, timingSafeEqual } from "crypto";

const DEV_SECRET = "dev-track-secret-change-in-production";

function getTrackSecret(): string {
  const secret = process.env.TRACK_SIGNING_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim() === "" || secret === DEV_SECRET) {
      throw new Error(
        "TRACK_SIGNING_SECRET must be set to a secure value in production (min 32 chars)"
      );
    }
    return secret.trim();
  }
  return secret?.trim() || DEV_SECRET;
}

export function signTrackToken(entityType: "move" | "delivery", id: string): string {
  const payload = `${entityType}:${id}`;
  const sig = createHmac("sha256", getTrackSecret()).update(payload).digest("base64url");
  return sig;
}

export function verifyTrackToken(
  entityType: "move" | "delivery",
  id: string,
  token: string
): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = signTrackToken(entityType, id);
  if (expected.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(token, "utf8"));
  } catch {
    return false;
  }
}
