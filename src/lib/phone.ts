/**
 * Global phone formatting: display as (123) 456-7890, store as digits only.
 */

/** Normalize to digits only (last 10 for US). Use for storage, API, and tel: links. */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

/**
 * Format for display as (123) 456-7890.
 * Accepts any string (digits, dashes, parens); uses last 10 digits.
 * Returns "" if no digits; otherwise partial format for &lt;10 digits, full for 10.
 */
export function formatPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
