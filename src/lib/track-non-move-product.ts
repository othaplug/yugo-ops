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

/**
 * True only when the booking is a full residential / commercial relocation —
 * i.e. the kind of job where the client has to pack, label boxes, prep
 * appliances, reserve elevators, and use the move-day checklist.
 *
 * Single-item runs, bin rentals, B2B deliveries, event logistics,
 * specialty pieces, labour-only sessions, and white-glove DELIVERIES
 * (vendor → client) are NOT full relocations — no prep checklist applies,
 * so the booking SMS / 72hr email / track page shouldn't surface a
 * "Move-day checklist" link to those clients.
 *
 * White-glove kind="service" (in-home assembly / install at the same
 * address) also returns false here — the crew handles everything, the
 * client doesn't pre-pack. Pass `whiteGloveKind` if the row is white-glove
 * so the function can distinguish vendor→client from in-home.
 */
export function isFullRelocationMove(opts: {
  serviceType: string | null | undefined;
  whiteGloveKind?: string | null | undefined;
}): boolean {
  const s = String(opts.serviceType || "").toLowerCase().trim();
  // Explicit relocation service types.
  if (s === "local_move" || s === "long_distance" || s === "office_move") {
    return true;
  }
  // White-glove is per-kind: delivery = not a relocation, in-home service
  // = no client packing either.
  if (s === "white_glove") return false;
  // Everything else (single_item, bin_rental, b2b_*, event, specialty,
  // labour_only) is not a full relocation.
  return false;
}
