/**
 * `moves` rows used for add-on or standalone products that are not a residential truck move.
 * Track UI should not show move crew stepper, truck timeline, or homeowner move prep.
 */
export function isTrackNonMoveProduct(
  serviceType: string | null | undefined,
): boolean {
  const s = String(serviceType || "").toLowerCase().trim();
  return s === "bin_rental";
}
