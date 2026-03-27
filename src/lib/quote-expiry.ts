/**
 * Quotes use `expires_at` in the database (typically end-of-day ET when created).
 * Book / pay only when not past expiry, with accepted quotes always bookable for display logic.
 */
export function isQuoteExpiredForBooking(quote: {
  expires_at?: string | null;
  status?: string | null;
}): boolean {
  const st = (quote.status || "").toLowerCase();
  if (st === "accepted") return false;
  if (!quote.expires_at) return false;
  return new Date(quote.expires_at) < new Date();
}

export function quoteExpiryBlockedStatuses(): string[] {
  return ["expired", "declined", "cancelled"];
}
