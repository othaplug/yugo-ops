import { requireStaff } from "@/lib/api-auth";
import { requirePartner } from "@/lib/partner-auth";

/**
 * Authorize access to a job's proof-of-delivery (signatures, photos, GPS,
 * addresses). POD is surfaced on the admin delivery page and the PARTNER portal
 * delivery modal, so a bare requireAuth let any logged-in client/partner read
 * ANY job's POD. Access is: staff (always), or a partner whose org owns the
 * delivery. Moves are not partner-owned, so their POD is staff-only.
 *
 * Returns true when allowed. `deliveryOrgId` is the delivery's organization_id
 * (null for a one-off with no partner account → staff-only).
 */
export async function canAccessDeliveryPod(
  deliveryOrgId: string | null | undefined,
): Promise<boolean> {
  const staff = await requireStaff();
  if (!staff.error) return true;
  const orgId = String(deliveryOrgId ?? "").trim();
  if (!orgId) return false;
  const partner = await requirePartner();
  if (partner.error) return false;
  return partner.orgIds.includes(orgId);
}

/** Staff-only gate (for move PODs, which have no partner owner). */
export async function isStaffSession(): Promise<boolean> {
  const staff = await requireStaff();
  return !staff.error;
}
