/**
 * Human-readable messages for Square Payments API errors.
 * Never surface raw API payloads or JSON to clients.
 */

const BY_CODE: Record<string, string> = {
  INSUFFICIENT_FUNDS:
    "Your bank declined this charge due to insufficient funds. Try another card or contact your bank.",
  EXPIRED_CARD: "This card has expired. Use a different card.",
  CARD_EXPIRED: "This card has expired. Use a different card.",
  CVV_FAILURE: "The security code did not match. Check your card and try again.",
  INVALID_EXPIRATION: "The expiration date is invalid. Check your card and try again.",
  INVALID_CARD: "This card could not be processed. Try another card.",
  INVALID_CARD_DATA: "This card could not be processed. Try another card.",
  CARD_NOT_SUPPORTED: "This card type is not accepted. Try another card.",
  CARD_DECLINED: "Your card was declined. Try another card or contact your bank.",
  GENERIC_DECLINE: "Your card was declined. Try another card or contact your bank.",
  ALLOWABLE_AMOUNT_EXCEEDED: "This charge exceeds your card limit. Try a smaller amount or another card.",
  PAYMENT_LIMIT_EXCEEDED: "This charge exceeds the allowed limit. Try a smaller amount or contact support.",
  ACCOUNT_UNAVAILABLE: "The payment could not be completed. Try again later or use another card.",
  VOICE_FAILURE: "The card issuer could not be reached. Try again in a moment.",
  PAN_FAILURE: "The card number is invalid. Check the number and try again.",
  BAD_EXPIRATION: "The expiration date is invalid. Check your card and try again.",
};

function normalizeCodeFromPayload(first: { code?: string; detail?: string; message?: string }): string | null {
  const c = (first.code || "").toUpperCase();
  const blob = `${first.detail || ""} ${first.message || ""}`.toUpperCase();
  if (blob.includes("INSUFFICIENT_FUNDS")) return "INSUFFICIENT_FUNDS";
  if (blob.includes("EXPIRED") && blob.includes("CARD")) return "EXPIRED_CARD";
  if (c && BY_CODE[c]) return c;
  return c || null;
}

/**
 * Map Square `payments.create` response `errors` array to a single client-safe string.
 */
export function squarePaymentErrorsToMessage(
  errors: Array<{ code?: string; message?: string; detail?: string }> | undefined
): string {
  if (!errors?.length) {
    return "Payment could not be completed. Please try again or contact support.";
  }
  const first = errors[0];
  const code = normalizeCodeFromPayload(first);
  if (code && BY_CODE[code]) return BY_CODE[code];

  const short = (first.detail || first.message || "").trim();
  if (
    short &&
    short.length <= 200 &&
    !short.startsWith("{") &&
    !short.includes("Status code:") &&
    !short.includes("Authorization error:")
  ) {
    return short;
  }

  return "Payment could not be completed. Please try again or use another card.";
}

/**
 * Safe message when the Square SDK throws (often a long string with JSON body).
 */
export function squareThrownErrorMessage(err: unknown): string {
  const fallback = "Payment could not be completed. Please try again or contact support.";
  if (!(err instanceof Error) || !err.message) return fallback;

  const msg = err.message;

  if (msg.includes("INSUFFICIENT_FUNDS")) {
    return BY_CODE.INSUFFICIENT_FUNDS;
  }

  const codeMatches = [...msg.matchAll(/"code"\s*:\s*"([^"]+)"/gi)];
  for (const m of codeMatches) {
    const code = m[1]?.toUpperCase();
    if (code && BY_CODE[code]) return BY_CODE[code];
  }

  if (msg.length > 400 || (msg.includes("Status code:") && msg.includes("{"))) {
    return fallback;
  }

  if (msg.length < 220 && !msg.trimStart().startsWith("{")) {
    return msg;
  }

  return fallback;
}
