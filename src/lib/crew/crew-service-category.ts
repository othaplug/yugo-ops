/**
 * Maps raw `moves.service_type` / `moves.move_type` to an internal flow bucket.
 * See `getCrewStatusFlowForMove` in `service-type-flow.ts` for the resulting checkpoints.
 */
export function normalizeCrewServiceCategory(
  serviceType: string | null | undefined,
  moveType: string | null | undefined,
): string {
  const st = (serviceType || "").toLowerCase().trim();
  const mt = (moveType || "").toLowerCase().trim();
  if (st === "labour_only" || mt === "labour_only") return "labour_only";
  if (st === "bin_rental_pickup" || mt === "bin_pickup") return "bin_rental_pickup";
  if (st === "bin_rental") return "bin_rental";
  if (st === "b2b_delivery" || st === "b2b_oneoff") return "b2b_delivery";
  if (st === "single_item") return "single_item";
  if (st === "event") return "event";
  if (st === "white_glove") return "white_glove";
  if (st === "office_move") return "b2b_delivery";
  if (
    st === "residential" ||
    st === "local_move" ||
    st === "long_distance" ||
    st === "" ||
    !st
  ) {
    return "residential";
  }
  return "residential";
}
