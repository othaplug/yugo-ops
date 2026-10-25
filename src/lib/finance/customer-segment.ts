/**
 * Customer segment — WHO the customer is, independent of WHAT service/tier they
 * bought. One source of truth for every finance/ops surface (see
 * docs/finance-metrics.md §4).
 *
 *   private_client      — a homeowner / individual (residential, any tier)
 *   contracted          — a B2B account: furniture retailer, designer, gallery,
 *                          hospitality, developer, one-off B2B delivery, etc.
 *   property_management — a PM account (building/portfolio turnovers), e.g.
 *                          Springfield Co-Operative Homes
 *
 * Derived from existing fields — no new column, applies to all history. NOTE: a
 * private client also has an `organization_id` (their own `b2c` org row), so we
 * must look at the org VERTICAL, never just the presence of an org id.
 */

export type CustomerSegment =
  | "private_client"
  | "contracted"
  | "property_management";

export const CUSTOMER_SEGMENT_LABEL: Record<CustomerSegment, string> = {
  private_client: "Private Client",
  contracted: "Contracted",
  property_management: "Property Management",
};

/** Org verticals/types that mean "property management". */
const PM_VERTICALS = new Set([
  "property_management_residential",
  "property_management_commercial",
  "property_manager",
  "pm",
]);

/** Service types that are inherently B2B (contracted work). */
const B2B_SERVICE_TYPES = new Set([
  "b2b_oneoff",
  "b2b_delivery",
  "b2b_outbound_stage",
]);

/** The individual-client org type; anything else non-PM is a B2B account. */
const PRIVATE_ORG_VERTICALS = new Set(["b2c", "", "individual", "residential"]);

export interface SegmentableJob {
  is_pm_move?: boolean | null;
  pm_reason_code?: string | null;
  contract_id?: string | null;
  organization_id?: string | null;
  service_type?: string | null;
}

/**
 * Resolve a job's customer segment. Pass `orgVertical` (organizations.vertical
 * or .type) when available — it is what distinguishes a B2B account from a
 * private client's own b2c org, and a PM account from either.
 */
export function getCustomerSegment(
  job: SegmentableJob,
  orgVertical?: string | null,
): { segment: CustomerSegment; label: string } {
  const v = String(orgVertical ?? "").toLowerCase().trim();
  const svc = String(job.service_type ?? "").toLowerCase().trim();
  const hasContract = !!(job.contract_id && String(job.contract_id).trim());

  // 1) Property management wins: explicit PM move flag, a PM reason code, or a
  //    PM org vertical.
  if (
    job.is_pm_move === true ||
    !!(job.pm_reason_code && String(job.pm_reason_code).trim()) ||
    (v && PM_VERTICALS.has(v))
  ) {
    return { segment: "property_management", label: CUSTOMER_SEGMENT_LABEL.property_management };
  }

  // 2) Contracted / B2B: a B2B service type, a signed contract, or a non-private
  //    org vertical (furniture_retailer, interior_designer, hospitality, …).
  const hasB2bVertical = !!v && !PRIVATE_ORG_VERTICALS.has(v);
  if (B2B_SERVICE_TYPES.has(svc) || hasContract || hasB2bVertical) {
    return { segment: "contracted", label: CUSTOMER_SEGMENT_LABEL.contracted };
  }

  // 3) Everyone else is a private client.
  return { segment: "private_client", label: CUSTOMER_SEGMENT_LABEL.private_client };
}

/** True when the job is NOT a private client (contracted or PM). */
export function isContractedOrPm(
  job: SegmentableJob,
  orgVertical?: string | null,
): boolean {
  return getCustomerSegment(job, orgVertical).segment !== "private_client";
}
