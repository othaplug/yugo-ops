import { toTitleCase } from "@/lib/format-text";

function pieceWord(n: number): "PIECE" | "PIECES" {
  return n === 1 ? "PIECE" : "PIECES";
}

/**
 * Calendar pill / API line for delivery jobs, e.g. `1 PIECE | B2B DELIVERY`.
 * When there is no positive item count, returns the kind line only (e.g. `STANDARD DELIVERY`).
 */
export function formatDeliveryCalendarDescription(
  itemCount: number | null | undefined,
  deliveryTypeOrCategory: string | null | undefined,
): string {
  const typePart = toTitleCase(String(deliveryTypeOrCategory ?? "").trim());
  const kindBase = `${typePart} Delivery`.replace(/\s+/g, " ").trim();
  const kind = kindBase.toUpperCase();

  const n = itemCount != null && itemCount > 0 ? Math.floor(Number(itemCount)) : 0;
  if (n > 0) {
    return `${n} ${pieceWord(n)} | ${kind}`;
  }
  return kind;
}

/**
 * `count PIECE(S) | rest` for partner list rows (customer name or first item label).
 */
export function formatPieceCountPipeRest(count: number, rest: string): string {
  const n = Math.floor(Math.max(0, count));
  if (n <= 0) return rest;
  return `${n} ${pieceWord(n)} | ${rest}`;
}
