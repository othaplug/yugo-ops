/**
 * Maps processor / gateway error codes to client- and admin-readable copy.
 * Raw API values (e.g. card_declined) must not appear in email bodies.
 */

const KNOWN: Record<string, string> = {
  card_declined:
    "Card declined. Try another card or contact your bank for details.",
  insufficient_funds: "Insufficient funds on the card.",
  incorrect_cvc: "The security code (CVC) was incorrect.",
  expired_card: "The card has expired.",
  invalid_card: "The card number is invalid.",
  processing_error:
    "The payment processor returned an error. Please try again or use another card.",
  authentication_required:
    "Your bank requires additional verification for this payment.",
  generic_decline: "The card was declined.",
  do_not_honor: "The bank declined the transaction.",
  lost_card: "The card was reported lost.",
  stolen_card: "The card was reported stolen.",
  pickup_card: "The bank asked to pick up the card.",
  try_again_later: "Payment could not be completed. Try again in a few minutes.",
};

function titleCaseSnake(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Human-readable explanation for a processor error string (code or short message).
 */
export function humanizePaymentProcessorMessage(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "Payment could not be completed.";
  const lower = s.toLowerCase();
  for (const [code, label] of Object.entries(KNOWN)) {
    if (lower.includes(code)) return label;
  }
  const key = lower.replace(/\s+/g, "_");
  if (KNOWN[key]) return KNOWN[key];
  if (!/[_]/.test(s) && s.length <= 240 && /[a-z]/i.test(s)) return s;
  return titleCaseSnake(key);
}
