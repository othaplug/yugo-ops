import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.TRACK_SIGNING_SECRET || "dev-track-secret-change-in-production";

export function signTrackToken(entityType: "move" | "delivery", id: string): string {
  const payload = `${entityType}:${id}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
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
