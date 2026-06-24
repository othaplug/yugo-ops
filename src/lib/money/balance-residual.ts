/**
 * Residual-balance threshold.
 *
 * Background (Geoff Scime-Gerrits MV-30311, 2026-06-24): a single-item
 * quote priced at $340 + 13% HST stored as amount=384.2 and deposit=384
 * (collected in full). The remaining balance computed to
 * 0.19999999999998863 — a floating-point ghost — which:
 *
 *   • triggered the 48h "balance due soon" reminder ("$0.20 due, Geoff")
 *     on the morning of the move
 *   • would have triggered the auto-charge cron (which would have failed
 *     against Square anyway since most regions reject sub-$1 charges)
 *
 * Fix: any balance under $1.00 is rounding noise, not real money owed.
 * Money paths (reminders, auto-charge, balance-due banners) must treat
 * balances below this threshold as settled.
 *
 * Why $1 and not $0.50 / $0.01: HST rounding can produce up-to-a-cent
 * residue, but legitimately-owed small balances (e.g., a forgotten add-on
 * priced at $0.99) basically don't exist in this business. Setting the
 * floor at $1.00 covers both the rounding case and the case where a
 * coordinator made a typo that produced a near-zero balance.
 */
export const RESIDUAL_BALANCE_THRESHOLD = 1;

/**
 * True when the balance is real money to collect (above the residual
 * floor). Use this in EVERY money path that decides "is anything owed?"
 * before nudging or charging the client.
 */
export function isCollectibleBalance(balance: number | null | undefined): boolean {
  const n = Number(balance ?? 0);
  return Number.isFinite(n) && n >= RESIDUAL_BALANCE_THRESHOLD;
}
