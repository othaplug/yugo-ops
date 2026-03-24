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

export function signTrackToken(entityType: "move" | "delivery" | "inbound_shipment", id: string): string {
  const payload = `${entityType}:${id}`;
  const sig = createHmac("sha256", getTrackSecret()).update(payload).digest("base64url");
  return sig;
}

export function verifyTrackToken(
  entityType: "move" | "delivery" | "inbound_shipment",
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

/** Sign a review_request id for use in email link (public, no session). Returns id.sig for URL. */
export function signReviewToken(reviewRequestId: string): string {
  const sig = createHmac("sha256", getTrackSecret()).update(`review:${reviewRequestId}`).digest("base64url");
  return `${reviewRequestId}.${sig}`;
}

/** Verify token (id.sig) and return review_request id, or null. */
export function verifyReviewToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const id = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  if (!id || !sig) return null;
  const expected = createHmac("sha256", getTrackSecret()).update(`review:${id}`).digest("base64url");
  if (expected.length !== sig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"))) return null;
    return id;
  } catch {
    return null;
  }
}
