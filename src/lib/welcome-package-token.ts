import { randomBytes } from "crypto";

/** URL-safe opaque token for Estate welcome guide links. */
export function generateWelcomePackageToken(): string {
  return randomBytes(24).toString("base64url");
}
