/**
 * Trust bar cell: "$2M Insurance" / "Full cargo coverage" only applies to jobs with
 * cargo in transit (moves and deliveries). Omit for bin rental (equipment rental) and
 * labour-only (no transit). Other service types are allowlisted so new quote types
 * do not show cargo claims by default.
 */
const CARGO_INSURANCE_TRUST_SERVICE_TYPES = new Set([
  "local_move",
  "long_distance",
  "office_move",
  "white_glove",
  "specialty",
  "single_item",
  "event",
  "b2b_delivery",
  "b2b_oneoff",
])

export const quoteShowsCargoInsuranceTrust = (
  serviceType: string | null | undefined,
): boolean => CARGO_INSURANCE_TRUST_SERVICE_TYPES.has(String(serviceType ?? ""))
