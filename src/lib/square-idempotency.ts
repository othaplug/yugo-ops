import { createHash } from "node:crypto"

/**
 * Build a Square-safe idempotency key.
 *
 * Square caps `idempotency_key` at **45 characters** on every endpoint
 * that accepts one (payments.create, customers.create, refunds.create,
 * invoices.publish, etc.). Going one byte over returns:
 *
 *   { code: "VALUE_TOO_LONG", category: "INVALID_REQUEST_ERROR",
 *     detail: "Field must not be greater than 45 length", status: 400 }
 *
 * Long natural keys (anything containing a 36-char UUID or a stored
 * `ccof:` card token) silently broke this rule. The earlier pattern of
 * concatenating `pay-${quoteId}-card-${squareCardId}` produced 48-char
 * keys for any quote with a card on file — every retry 400'd before
 * Square even reached the bank.
 *
 * `squareIdem(prefix, ...parts)` joins the parts with `-`, returns the
 * verbatim string when it fits in 45 chars (preserves debuggability), and
 * otherwise collapses everything past the prefix into a stable sha256
 * hash so the key stays **deterministic per logical request** (no
 * double-charges on retry) and stays **<= 45 chars** (no
 * VALUE_TOO_LONG).
 *
 * @example
 *   squareIdem("pay", quoteId)                  → "pay-YG-30240"            (12)
 *   squareIdem("pay", quoteId, "card", cardId)  → "pay-9a8d4f3c1b6e2..."    (44, hashed)
 *   squareIdem("bal-track", moveUuid)           → "bal-track-c1d2e3f..."    (44, hashed)
 */
export function squareIdem(prefix: string, ...parts: string[]): string {
  const safeParts = parts.map((p) => String(p ?? "").trim()).filter(Boolean)
  const joined = safeParts.length > 0 ? `${prefix}-${safeParts.join("-")}` : prefix
  if (joined.length <= 45) return joined

  // Past 45 chars — keep the prefix + as much hash as fits. Hash includes
  // the prefix so two distinct logical requests with the same parts but
  // different prefixes don't collide.
  const hash = createHash("sha256").update(joined).digest("hex")
  const headroom = Math.max(8, 45 - prefix.length - 1) // 1 for the dash separator
  return `${prefix}-${hash.slice(0, headroom)}`
}
