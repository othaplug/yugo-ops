/**
 * Super admin email — must be set via env in production.
 * Returns empty string if not set (page still loads; no one is super admin).
 */
const DEV_FALLBACK = "othaplug@gmail.com";

export function getSuperAdminEmail(): string {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!email || email.length < 3) {
      console.warn("SUPER_ADMIN_EMAIL not set in production — set it in your env for super admin access");
      return "";
    }
    return email.toLowerCase();
  }
  return (email || DEV_FALLBACK).toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  try {
    return (email || "").toLowerCase() === getSuperAdminEmail();
  } catch {
    return false;
  }
}
