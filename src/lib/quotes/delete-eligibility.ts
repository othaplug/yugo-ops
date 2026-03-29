/**
 * Who may hard-delete a quote row (API also requires no linked move; never accepted).
 */

export const QUOTE_DELETABLE_BY_STAFF_STATUSES = new Set(["draft"]);

/** Non-accepted pipeline / terminal states superadmin may remove for CRM-style cleanup. */
export const QUOTE_DELETABLE_SUPERADMIN_EXTRA_STATUSES = new Set([
  "sent",
  "viewed",
  "expired",
  "declined",
  "superseded",
]);

export function quoteStatusAllowsHardDelete(
  status: string | null | undefined,
  isSuperAdmin: boolean,
): boolean {
  const s = (status || "draft").trim();
  if (s === "accepted") return false;
  if (QUOTE_DELETABLE_BY_STAFF_STATUSES.has(s)) return true;
  if (isSuperAdmin && QUOTE_DELETABLE_SUPERADMIN_EXTRA_STATUSES.has(s)) return true;
  return false;
}
