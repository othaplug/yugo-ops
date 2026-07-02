/**
 * Shared fleet label formatter for office relocations.
 *
 * Single source of truth so the confirmation email, OfficeTrackHero,
 * and admin previews can't drift when a booking uses multiple trucks
 * (e.g. "2 × 16ft Fully Equipped Truck" instead of just "16ft").
 */

export const TRUCK_DISPLAY_MAP: Record<string, string> = {
  sprinter: "Extended Sprinter Van",
  "16ft": "16ft Fully Equipped Truck",
  "20ft": "20ft Dedicated Moving Truck",
  "24ft": "24ft Full-Size Moving Truck",
  "26ft": "26ft Maximum-Capacity Truck",
};

/**
 * Format a fleet label from a raw truck key and an optional count.
 *
 * @param truckKey Raw key stored on the move/quote (e.g. "16ft", "sprinter").
 * @param count Number of trucks reserved; null / 1 renders the plain label.
 * @param fallback Rendered when the key is empty and no known display maps.
 */
export function formatOfficeFleetLabel(
  truckKey: string | null | undefined,
  count?: number | null,
  fallback = "Dedicated moving truck",
): string {
  const raw = (truckKey ?? "").trim().toLowerCase();
  const base = TRUCK_DISPLAY_MAP[raw] || (raw ? truckKey! : fallback);
  const n = typeof count === "number" && count > 1 ? Math.floor(count) : 1;
  return n > 1 ? `${n} × ${base}` : base;
}
