import { isSuperAdminEmail } from "@/lib/super-admin";

/** Owner and super admin emails: full access. Admin and manager: senior staff (post-completion price edit). */
export const FINAL_PRICE_EDIT_ROLES = new Set(["owner", "admin", "manager"]);

export const canEditFinalJobPrice = (
  platformRole: string | null | undefined,
  email: string | null | undefined,
): boolean => {
  if (isSuperAdminEmail(email)) return true;
  const r = (platformRole || "").trim().toLowerCase();
  return FINAL_PRICE_EDIT_ROLES.has(r);
};
