const SUPER_ADMIN_EMAILS = [
  "othaplug@gmail.com",
  "oche@helloyugo.com",
];

export function getSuperAdminEmails(): string[] {
  const envEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const emails = new Set(SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()));
  if (envEmail && envEmail.length >= 3) emails.add(envEmail);
  return [...emails];
}

export function getSuperAdminEmail(): string {
  const envEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (envEmail && envEmail.length >= 3) return envEmail;
  return SUPER_ADMIN_EMAILS[0].toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return getSuperAdminEmails().includes(normalized);
}
