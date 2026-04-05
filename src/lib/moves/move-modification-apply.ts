/** Build `moves` row patch from coordinator/client-approved modification `changes` JSON. */
export function movePatchFromModificationChanges(
  changes: Record<string, unknown>,
  newPrice: number,
  originalPrice: number,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const c = changes as {
    new_date?: string;
    new_from_address?: string;
    new_to_address?: string;
    new_tier?: string;
  };
  if (c.new_date && String(c.new_date).trim()) patch.scheduled_date = String(c.new_date).trim();
  if (c.new_from_address && String(c.new_from_address).trim())
    patch.from_address = String(c.new_from_address).trim();
  if (c.new_to_address && String(c.new_to_address).trim()) {
    const addr = String(c.new_to_address).trim();
    patch.to_address = addr;
    patch.delivery_address = addr;
  }
  if (c.new_tier && String(c.new_tier).trim())
    patch.tier_selected = String(c.new_tier).trim().toLowerCase();
  if (newPrice !== originalPrice) patch.amount = newPrice;
  return patch;
}
