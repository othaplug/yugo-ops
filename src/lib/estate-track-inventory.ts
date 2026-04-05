/**
 * Estate tier: large homes use walkthrough-documented scope instead of a client-facing itemized list.
 * Move list sizes follow `moves.move_size` / quote `move_size` tokens.
 */
const WALKTHROUGH_SCOPED_MOVE_SIZES = new Set([
  "3br",
  "4br",
  "4br_plus",
  "5br_plus",
]);

/**
 * When true, Estate clients should see the walkthrough scope disclaimer instead of the full inventory UI.
 * Unknown or smaller sizes (studio–2br, partial, null) keep the normal list.
 */
export function estateUsesWalkthroughScopedInventory(
  moveSize: string | null | undefined,
): boolean {
  const key = String(moveSize ?? "")
    .trim()
    .toLowerCase();
  return WALKTHROUGH_SCOPED_MOVE_SIZES.has(key);
}
