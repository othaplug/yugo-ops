/**
 * Display name for B2B delivery invoices: prefer quote/delivery business fields
 * so internal org records (e.g. platform seller) never appear as the customer.
 */
export function resolveB2BInvoiceCustomerName(params: {
  business_name?: string | null;
  client_name?: string | null;
  customer_name?: string | null;
  organizationName?: string | null;
}): string {
  const fromDelivery =
    params.business_name?.trim() ||
    params.client_name?.trim() ||
    params.customer_name?.trim() ||
    "";
  if (fromDelivery) return fromDelivery;
  const org = params.organizationName?.trim() || "";
  if (org && !isLikelyInternalSellerName(org)) return org;
  return org || "Partner";
}

function isLikelyInternalSellerName(name: string): boolean {
  const compact = name.replace(/[\s._-]/g, "").toLowerCase();
  if (compact === "yugo" || compact === "yugomoving") return true;
  const lower = name.toLowerCase();
  return (
    lower.includes("helloyugo") ||
    lower.includes("hello yugo") ||
    compact.includes("helloyugo")
  );
}
