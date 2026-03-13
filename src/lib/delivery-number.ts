/**
 * Generate a unique delivery number in DLV-xxxx format.
 * Used by all delivery creation paths for consistent IDs.
 */
export function generateDeliveryNumber(): string {
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `DLV-${String(n).padStart(4, "0")}`;
}
