/**
 * Every quote in the system is valid for exactly this many days from the moment
 * it is created or (re)sent. This is a firm, global rule: it deliberately
 * overrides the old per-service-type quote_expiry_policy table and the
 * quote_expiry_days platform_config key, both of which could extend some
 * verticals (e.g. white glove, b2b_delivery) to 30 days. All quote-creation and
 * send paths compute expires_at from this single constant so no service type can
 * diverge.
 */
export const QUOTE_VALIDITY_DAYS = 7;

/** expires_at for a quote created/sent at `from` (defaults to now). */
export function quoteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + QUOTE_VALIDITY_DAYS * 86_400_000);
}
