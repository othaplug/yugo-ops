/**
 * Tiered referral program.
 *
 * Set 2026-06-24 by Oche: smaller moves are lower-margin, so the referral
 * discount + matching credit step down proportionally.
 *
 *   • 2BR moves and larger     → $100 off friend / $100 credit referrer
 *   • Studio + 1BR moves       → $50  off friend / $50  credit referrer
 *
 * The tier is decided by the FRIEND's booked move size — not the referrer's
 * — because the discount applies to the friend's quote.
 *
 * Both sides of the deal see the tier breakdown up front (perks card +
 * quote page) so nobody gets surprised by half the amount they expected.
 */

export type ReferralTier = {
  /** Dollar amount discounted from the friend's quote total. */
  discount: number;
  /** Dollar amount credited to the referrer when the friend books. */
  credit: number;
  /** Human label for UI ("2BR+ tier", "1BR tier"). */
  label: string;
};

export const REFERRAL_TIER_FULL: ReferralTier = {
  discount: 100,
  credit: 100,
  label: "2BR+ tier",
};

export const REFERRAL_TIER_HALF: ReferralTier = {
  discount: 50,
  credit: 50,
  label: "Studio / 1BR tier",
};

/**
 * Resolve the tier from a quote/move move_size value.
 *
 * Known residential values: studio | 1br | 2br | 3br | 4br.
 *
 * Unknown / missing values default to FULL ($100) — the referrer gets the
 * benefit of the doubt so we don't silently halve a legitimate $100 discount
 * because some new move-size string slipped through.
 */
export function getReferralTier(moveSize: string | null | undefined): ReferralTier {
  const s = (moveSize ?? "").toString().trim().toLowerCase();
  if (s === "studio" || s === "1br") return REFERRAL_TIER_HALF;
  return REFERRAL_TIER_FULL;
}
