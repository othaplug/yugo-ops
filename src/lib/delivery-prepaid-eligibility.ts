/** B2B-style delivery: same shape as tracking token issuance (no server imports). */
export function deliveryEligibleForAdminPrepaidMark(row: {
  booking_type?: string | null;
  organization_id?: string | null;
  category?: string | null;
  vertical_code?: string | null;
  status?: string | null;
}): boolean {
  if (String(row.status || "").toLowerCase() === "cancelled") return false;
  const cat = String(row.category ?? "").toLowerCase();
  const vertical = String(row.vertical_code ?? "").trim();
  return (
    (row.booking_type === "one_off" && !row.organization_id) ||
    cat === "b2b" ||
    vertical.length > 0
  );
}
