/**
 * Square SDK v44 returns Payment fields in camelCase (`receiptUrl`).
 * Older code across this repo read `.receipt_url` (snake_case) which
 * was always undefined against v44, so every deposit / balance / tip /
 * supplies / approved-fee charge was silently discarding the receipt
 * URL — that's why moves.square_receipt_url was null for jobs like
 * Julie's MV-30348 and their track-page Documents tab showed nothing.
 *
 * This helper reads camelCase first (the correct v44 shape) and falls
 * back to snake_case so any legacy webhook payload or REST response
 * still resolves.
 */
export function readSquareReceiptUrl(
  payment: unknown,
): string | null {
  if (!payment || typeof payment !== "object") return null;
  const p = payment as { receiptUrl?: string | null; receipt_url?: string | null };
  return p.receiptUrl ?? p.receipt_url ?? null;
}
