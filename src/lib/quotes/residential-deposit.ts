/**
 * THE single source of truth for residential (local move) tier deposits.
 *
 * One system: deposit = max(minimum, percentage × pre-tax tier price). The
 * minimum only catches small jobs; once the percentage exceeds the minimum it
 * takes over naturally. Every residential surface — quote generation (what we
 * store), the client quote page (what we display), the booking step (what we
 * charge), and the server payment check (what we validate) — MUST call this
 * function so they can never disagree again.
 *
 * Policy (operator-confirmed 2026-09-15):
 *   Essential  10%, minimum $150
 *   Signature  10%, minimum $250
 *   Estate     30%, no minimum
 *
 * Note: long distance, office, labour, and event are separate services with
 * their own policy and are NOT computed here.
 */
export const RESIDENTIAL_DEPOSIT_POLICY: Record<string, { pct: number; min: number }> = {
  essential: { pct: 0.1, min: 150 },
  signature: { pct: 0.1, min: 250 },
  estate: { pct: 0.3, min: 0 },
};

/** deposit = max(minimum, round(percentage × pre-tax price)). */
export function residentialTierDeposit(tier: string, preTaxPrice: number): number {
  const policy =
    RESIDENTIAL_DEPOSIT_POLICY[(tier || "").toLowerCase()] ??
    RESIDENTIAL_DEPOSIT_POLICY.essential;
  const price = Number.isFinite(preTaxPrice) && preTaxPrice > 0 ? preTaxPrice : 0;
  return Math.max(policy.min, Math.round(price * policy.pct));
}
