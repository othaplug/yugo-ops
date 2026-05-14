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
 * Square SDK v44 throws a `SquareError` with `statusCode`, `body`, and a
 * structured `errors` array (`{ category, code, detail?, field? }[]`). The
 * older string-parsing path was missing the structured array entirely, so
 * every SDK exception fell through to the generic "Payment could not be
 * completed" — making it impossible to tell INSUFFICIENT_FUNDS from
 * GENERIC_DECLINE from a network blip just from the customer-facing copy.
 */
export type StructuredSquareError = {
  /** Already-mapped, human-safe message. */
  message: string
  /** Highest-priority error code from Square (UPPERCASE) when available. */
  code: string | null
  /** First Square category (PAYMENT_METHOD_ERROR, AUTHENTICATION_ERROR, etc.). */
  category: string | null
  /** Free-text Square `detail` field (longer technical reason). */
  detail: string | null
  /** HTTP status from Square (4xx vs 5xx — drives retry decisions). */
  statusCode: number | null
  /** Full Square errors array, preserved for webhook_logs / forensics. */
  raw: Array<{ code?: string; category?: string; detail?: string; field?: string }> | null
}

function readSquareError(err: unknown): {
  errors: Array<{ code?: string; category?: string; detail?: string; field?: string }> | null
  statusCode: number | null
} {
  if (!err || typeof err !== "object") return { errors: null, statusCode: null }
  const obj = err as { errors?: unknown; statusCode?: unknown }
  const errors =
    Array.isArray(obj.errors) && obj.errors.length > 0
      ? (obj.errors as Array<{ code?: string; category?: string; detail?: string; field?: string }>)
      : null
  const sc = typeof obj.statusCode === "number" ? obj.statusCode : null
  return { errors, statusCode: sc }
}

/**
 * Parse a thrown SDK error into a structured + safe-to-show payload.
 * Use this in payment routes so the catch block can persist the structured
 * fields (category, code, statusCode, raw detail) alongside the message.
 */
export function squareThrownErrorStructured(err: unknown): StructuredSquareError {
  const fallback = "Payment could not be completed. Please try again or contact support."
  const empty: StructuredSquareError = {
    message: fallback,
    code: null,
    category: null,
    detail: null,
    statusCode: null,
    raw: null,
  }
  if (!err) return empty

  // ── Structured SquareError path (preferred) ────────────────────────────
  const { errors, statusCode } = readSquareError(err)
  if (errors && errors.length > 0) {
    const first = errors[0]
    const code = (first.code || "").toUpperCase() || null
    const mapped = code && BY_CODE[code] ? BY_CODE[code] : null
    const detail = (first.detail || "").trim() || null
    return {
      message: mapped ?? (detail && detail.length <= 200 ? detail : fallback),
      code,
      category: first.category || null,
      detail,
      statusCode,
      raw: errors,
    }
  }

  // ── Fallback: string parsing for older shape / wrapped errors ───────────
  if (!(err instanceof Error) || !err.message) return { ...empty, statusCode }
  const msg = err.message

  if (msg.includes("INSUFFICIENT_FUNDS")) {
    return { ...empty, code: "INSUFFICIENT_FUNDS", message: BY_CODE.INSUFFICIENT_FUNDS, statusCode }
  }

  const codeMatches = [...msg.matchAll(/"code"\s*:\s*"([^"]+)"/gi)]
  for (const m of codeMatches) {
    const code = m[1]?.toUpperCase()
    if (code && BY_CODE[code]) {
      return { ...empty, code, message: BY_CODE[code], statusCode }
    }
  }

  if (msg.length > 400 || (msg.includes("Status code:") && msg.includes("{"))) {
    return { ...empty, statusCode }
  }
  if (msg.length < 220 && !msg.trimStart().startsWith("{")) {
    return { ...empty, message: msg, statusCode }
  }
  return { ...empty, statusCode }
}

/**
 * Back-compat wrapper — returns just the human-safe message string.
 */
export function squareThrownErrorMessage(err: unknown): string {
  return squareThrownErrorStructured(err).message
}
